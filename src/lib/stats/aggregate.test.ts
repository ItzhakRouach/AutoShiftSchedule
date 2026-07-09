import { describe, it, expect } from 'vitest'
import { aggregateEmployees, aggregateFairness } from './aggregate'

const employees = [
  { id: 'e1', name: 'דנה', color: '#f00', min_shifts_per_week: 3 },
  { id: 'e2', name: 'יוסי', color: '#0f0', min_shifts_per_week: 2 },
]

const mkAssign = (
  employee_id: string,
  day_of_week: number,
  shift_type_id: string,
  role_id: string,
  hours: number,
  is_fallback = false,
) => ({ employee_id, day_of_week, shift_type_id, role_id, hours, is_fallback })

// ─── aggregateEmployees ───────────────────────────────────────────────────────
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

// ─── aggregateFairness ────────────────────────────────────────────────────────
describe('aggregateFairness', () => {
  const shiftKeyById = new Map([
    ['st_morning', 'morning'],
    ['st_night', 'night'],
  ])

  it('counts night and weekend shifts', () => {
    const assignments = [
      mkAssign('e1', 5, 'st_night', 'r1', 8),   // weekend + night
      mkAssign('e1', 6, 'st_morning', 'r1', 8), // weekend only
      mkAssign('e1', 0, 'st_night', 'r1', 8),   // night only
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

  it('computes requestedCount and honoredCount correctly', () => {
    const assignments = [mkAssign('e1', 0, 'st_morning', 'r1', 8)]
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_morning'] },
      { employee_id: 'e1', period_id: 'p1', day_of_week: 1, is_off: false, preferred_shift_ids: ['st_night'] },
    ]
    const result = aggregateFairness(assignments, requests, employees, shiftKeyById)
    const e1 = result.find((f) => f.id === 'e1')!
    expect(e1.requestedCount).toBe(2)
    expect(e1.honoredCount).toBe(1)
  })

  it('counts an off-day request honored when the employee does not work that day', () => {
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: true, preferred_shift_ids: null },
    ]
    const result = aggregateFairness([], requests, employees, shiftKeyById)
    const e1 = result.find((f) => f.id === 'e1')!
    expect(e1.requestedCount).toBe(1)
    expect(e1.honoredCount).toBe(1) // no assignments → the day off was honored
  })

  it('returns zero counts when preferred_shift_ids is empty (no-request guard)', () => {
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: [] },
    ]
    const result = aggregateFairness([], requests, employees, shiftKeyById)
    const e1 = result.find((f) => f.id === 'e1')!
    expect(e1.requestedCount).toBe(0)
    expect(e1.honoredCount).toBe(0)
  })

  it('returns honoredCount = requestedCount when all requests are honored', () => {
    const assignments = [
      mkAssign('e1', 0, 'st_morning', 'r1', 8),
      mkAssign('e1', 1, 'st_night', 'r1', 8),
    ]
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_morning'] },
      { employee_id: 'e1', period_id: 'p1', day_of_week: 1, is_off: false, preferred_shift_ids: ['st_night'] },
    ]
    const result = aggregateFairness(assignments, requests, employees, shiftKeyById)
    const e1 = result.find((f) => f.id === 'e1')!
    expect(e1.requestedCount).toBe(2)
    expect(e1.honoredCount).toBe(2)
  })
})

// ─── 12h-covers request matching ─────────────────────────────────────────────
describe('aggregateFairness — 12h covers requested base shifts', () => {
  const keyById = new Map([
    ['st_morning', 'morning'],
    ['st_noon', 'noon'],
    ['st_night', 'night'],
    ['st_m12day', 'm12_day'],
    ['st_m12night', 'm12_night'],
  ])

  it('m12_day honors a requested morning', () => {
    const assignments = [mkAssign('e1', 0, 'st_m12day', 'r1', 12, true)]
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_morning'] },
    ]
    const e1 = aggregateFairness(assignments, requests, employees, keyById).find((f) => f.id === 'e1')!
    expect(e1.honoredCount).toBe(1)
  })

  it('m12_night honors a requested NOON (covers, not fills)', () => {
    const assignments = [mkAssign('e1', 2, 'st_m12night', 'r1', 12, true)]
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 2, is_off: false, preferred_shift_ids: ['st_noon'] },
    ]
    const e1 = aggregateFairness(assignments, requests, employees, keyById).find((f) => f.id === 'e1')!
    expect(e1.honoredCount).toBe(1)
  })

  it('m12_night does NOT honor a requested morning', () => {
    const assignments = [mkAssign('e1', 2, 'st_m12night', 'r1', 12, true)]
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 2, is_off: false, preferred_shift_ids: ['st_morning'] },
    ]
    const e1 = aggregateFairness(assignments, requests, employees, keyById).find((f) => f.id === 'e1')!
    expect(e1.honoredCount).toBe(0)
  })

  it('granted off-day still counts as honored (unchanged)', () => {
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 3, is_off: true, preferred_shift_ids: [] },
    ]
    const e1 = aggregateFairness([], requests, employees, keyById).find((f) => f.id === 'e1')!
    expect(e1.honoredCount).toBe(1)
  })
})
