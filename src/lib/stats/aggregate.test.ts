import { describe, it, expect } from 'vitest'
import {
  aggregateKPIs,
  aggregateEmployees,
  aggregateRoles,
  aggregateFairness,
} from './aggregate'

const employees = [
  { id: 'e1', name: 'דנה', color: '#f00' },
  { id: 'e2', name: 'יוסי', color: '#0f0' },
]

const roles = [
  { id: 'r1', name: 'מאבטח', color: '#13A98E' },
  { id: 'r2', name: 'מוקדן', color: '#3D6BF5' },
]

const mkAssign = (
  employee_id: string,
  day_of_week: number,
  shift_type_id: string,
  role_id: string,
  hours: number,
) => ({ employee_id, day_of_week, shift_type_id, role_id, hours, is_fallback: false })

describe('aggregateKPIs', () => {
  it('sums shifts and hours correctly', () => {
    const assignments = [
      mkAssign('e1', 0, 'st1', 'r1', 8),
      mkAssign('e1', 1, 'st2', 'r1', 8),
      mkAssign('e2', 0, 'st1', 'r2', 8),
    ]
    const kpis = aggregateKPIs(assignments, employees, null)
    expect(kpis.totalShifts).toBe(3)
    expect(kpis.totalHours).toBe(24)
    expect(kpis.activeEmployees).toBe(2)
    expect(kpis.coveragePct).toBeNull()
  })

  it('computes coverage pct', () => {
    const kpis = aggregateKPIs([], employees, { filled: 7, required: 10 })
    expect(kpis.coveragePct).toBe(70)
  })

  it('handles zero requirements without divide-by-zero', () => {
    const kpis = aggregateKPIs([], employees, { filled: 0, required: 0 })
    expect(kpis.coveragePct).toBeNull()
  })
})

describe('aggregateEmployees', () => {
  it('accumulates hours and shifts per employee, sorted by hours desc', () => {
    const assignments = [
      mkAssign('e1', 0, 'st1', 'r1', 8),
      mkAssign('e2', 0, 'st1', 'r1', 12),
      mkAssign('e2', 1, 'st2', 'r2', 8),
    ]
    const result = aggregateEmployees(assignments, employees)
    expect(result[0].id).toBe('e2')
    expect(result[0].hours).toBe(20)
    expect(result[0].shifts).toBe(2)
    expect(result[1].id).toBe('e1')
    expect(result[1].hours).toBe(8)
  })

  it('returns zero for employees with no assignments', () => {
    const result = aggregateEmployees([], employees)
    expect(result.every((e) => e.hours === 0 && e.shifts === 0)).toBe(true)
  })
})

describe('aggregateRoles', () => {
  it('counts assignments per role', () => {
    const assignments = [
      mkAssign('e1', 0, 'st1', 'r1', 8),
      mkAssign('e1', 1, 'st1', 'r1', 8),
      mkAssign('e2', 0, 'st1', 'r2', 8),
    ]
    const result = aggregateRoles(assignments, roles)
    const r1 = result.find((r) => r.id === 'r1')!
    const r2 = result.find((r) => r.id === 'r2')!
    expect(r1.count).toBe(2)
    expect(r2.count).toBe(1)
  })
})

describe('aggregateFairness', () => {
  const shiftKeyById = new Map([
    ['st_morning', 'morning'],
    ['st_night', 'night'],
  ])

  it('counts night and weekend shifts', () => {
    const assignments = [
      mkAssign('e1', 5, 'st_night', 'r1', 8), // weekend + night
      mkAssign('e1', 6, 'st_morning', 'r1', 8), // weekend only
      mkAssign('e1', 0, 'st_night', 'r1', 8), // night only
      mkAssign('e2', 0, 'st_morning', 'r2', 8), // none
    ]
    const result = aggregateFairness(assignments, [], employees, shiftKeyById)
    const e1 = result.find((f) => f.id === 'e1')!
    expect(e1.nightShifts).toBe(2)
    expect(e1.weekendShifts).toBe(2)
    const e2 = result.find((f) => f.id === 'e2')!
    expect(e2.nightShifts).toBe(0)
    expect(e2.weekendShifts).toBe(0)
  })

  it('computes requestHonoredPct correctly', () => {
    const assignments = [mkAssign('e1', 0, 'st_morning', 'r1', 8)]
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_morning'] },
      { employee_id: 'e1', period_id: 'p1', day_of_week: 1, is_off: false, preferred_shift_ids: ['st_night'] },
    ]
    const result = aggregateFairness(assignments, requests, employees, shiftKeyById)
    const e1 = result.find((f) => f.id === 'e1')!
    expect(e1.requestHonoredPct).toBe(50)
  })

  it('returns null when no non-off requests exist (divide-by-zero guard)', () => {
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: true, preferred_shift_ids: null },
    ]
    const result = aggregateFairness([], requests, employees, shiftKeyById)
    const e1 = result.find((f) => f.id === 'e1')!
    expect(e1.requestHonoredPct).toBeNull()
  })

  it('returns null when preferred_shift_ids is empty', () => {
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: [] },
    ]
    const result = aggregateFairness([], requests, employees, shiftKeyById)
    const e1 = result.find((f) => f.id === 'e1')!
    expect(e1.requestHonoredPct).toBeNull()
  })
})
