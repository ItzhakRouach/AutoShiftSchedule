import { describe, it, expect } from 'vitest'
import { aggregateKPIs, computeTwoRequestsHonored, coverageColor } from './aggregate'

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

// ─── coverageColor ────────────────────────────────────────────────────────────
describe('coverageColor', () => {
  it('returns green for 100%', () => expect(coverageColor(100)).toBe('green'))
  it('returns green for above 100%', () => expect(coverageColor(120)).toBe('green'))
  it('returns amber for 80–99%', () => expect(coverageColor(85)).toBe('amber'))
  it('returns red for below 80%', () => expect(coverageColor(79)).toBe('red'))
  it('returns red for null', () => expect(coverageColor(null)).toBe('red'))
})

// ─── aggregateKPIs ────────────────────────────────────────────────────────────
describe('aggregateKPIs', () => {
  it('computes coverage pct and color', () => {
    const kpis = aggregateKPIs([], employees, { filled: 8, required: 10 }, [])
    expect(kpis.coveragePct).toBe(80)
    expect(kpis.coverageColor).toBe('amber')
    expect(kpis.filledSlots).toBe(8)
    expect(kpis.requiredSlots).toBe(10)
  })

  it('handles zero requirements without divide-by-zero (null coverage)', () => {
    const kpis = aggregateKPIs([], employees, { filled: 0, required: 0 }, [])
    expect(kpis.coveragePct).toBeNull()
    expect(kpis.uncoveredSlots).toBe(0)
  })

  it('handles null requirementSummary', () => {
    const kpis = aggregateKPIs([], employees, null, [])
    expect(kpis.coveragePct).toBeNull()
    expect(kpis.uncoveredSlots).toBe(0)
  })

  it('computes uncoveredSlots = required − filled', () => {
    const kpis = aggregateKPIs([], employees, { filled: 7, required: 10 }, [])
    expect(kpis.uncoveredSlots).toBe(3)
  })

  it('uncoveredSlots is 0 when filled >= required', () => {
    const kpis = aggregateKPIs([], employees, { filled: 12, required: 10 }, [])
    expect(kpis.uncoveredSlots).toBe(0)
  })

  it('counts 12h fallback shifts in shifts12h', () => {
    const periodAssignments = [
      mkAssign('e1', 0, 'st12', 'r1', 12, true),
      mkAssign('e1', 1, 'st8', 'r1', 8, false),
      mkAssign('e2', 0, 'st12', 'r2', 12, true),
    ]
    const kpis = aggregateKPIs(periodAssignments, employees, null, [])
    expect(kpis.shifts12h).toBe(2)
  })

  it('counts employees below min_shifts_per_week', () => {
    // e1 min=3 gets 1 shift → below; e2 min=2 gets 2 shifts → OK
    const periodAssignments = [
      mkAssign('e1', 0, 'st1', 'r1', 8),
      mkAssign('e2', 0, 'st1', 'r2', 8),
      mkAssign('e2', 1, 'st1', 'r2', 8),
    ]
    const kpis = aggregateKPIs(periodAssignments, employees, null, [])
    expect(kpis.belowMinCount).toBe(1)
  })

  it('belowMinCount = 0 when all employees meet minimum', () => {
    const periodAssignments = [
      mkAssign('e1', 0, 'st1', 'r1', 8),
      mkAssign('e1', 1, 'st1', 'r1', 8),
      mkAssign('e1', 2, 'st1', 'r1', 8),
      mkAssign('e2', 0, 'st1', 'r2', 8),
      mkAssign('e2', 1, 'st1', 'r2', 8),
    ]
    const kpis = aggregateKPIs(periodAssignments, employees, null, [])
    expect(kpis.belowMinCount).toBe(0)
  })

  it('exposes activeEmployees', () => {
    const kpis = aggregateKPIs([], employees, null, [])
    expect(kpis.activeEmployees).toBe(2)
  })
})

// ─── computeTwoRequestsHonored ────────────────────────────────────────────────
describe('computeTwoRequestsHonored', () => {
  it('counts employees with ≥2 honored requests as passing', () => {
    // e1 has 3 requests, 2 honored → passes
    // e2 has 2 requests, 1 honored → fails
    const assignments = [
      mkAssign('e1', 0, 'st_morning', 'r1', 8),
      mkAssign('e1', 1, 'st_morning', 'r1', 8),
      mkAssign('e2', 0, 'st_morning', 'r2', 8),
    ]
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_morning'] },
      { employee_id: 'e1', period_id: 'p1', day_of_week: 1, is_off: false, preferred_shift_ids: ['st_morning'] },
      { employee_id: 'e1', period_id: 'p1', day_of_week: 2, is_off: false, preferred_shift_ids: ['st_night'] },
      { employee_id: 'e2', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_morning'] },
      { employee_id: 'e2', period_id: 'p1', day_of_week: 1, is_off: false, preferred_shift_ids: ['st_night'] },
    ]
    const result = computeTwoRequestsHonored(assignments, requests, employees)
    expect(result.count).toBe(1)
    expect(result.total).toBe(2)
  })

  it('edge case: employee with exactly 1 request passes if that 1 is honored', () => {
    const assignments = [mkAssign('e1', 0, 'st_morning', 'r1', 8)]
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_morning'] },
    ]
    const result = computeTwoRequestsHonored(assignments, requests, employees)
    expect(result.count).toBe(1)
    expect(result.total).toBe(1)
  })

  it('edge case: employee with exactly 1 request fails if not honored', () => {
    const assignments = [mkAssign('e1', 0, 'st_night', 'r1', 8)]
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_morning'] },
    ]
    const result = computeTwoRequestsHonored(assignments, requests, employees)
    expect(result.count).toBe(0)
    expect(result.total).toBe(1)
  })

  it('counts an off-day request toward the honored total when the day off is given', () => {
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: true, preferred_shift_ids: null },
    ]
    const result = computeTwoRequestsHonored([], requests, employees)
    // 1 request (off-day), threshold min(2,1)=1, honored (no assignments) → passes.
    expect(result.count).toBe(1)
    expect(result.total).toBe(1)
  })

  it('employees with empty preferred_shift_ids are excluded from total', () => {
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: [] },
    ]
    const result = computeTwoRequestsHonored([], requests, employees)
    expect(result.count).toBe(0)
    expect(result.total).toBe(0)
  })

  it('all employees pass when all have ≥2 honored', () => {
    const assignments = [
      mkAssign('e1', 0, 'st_morning', 'r1', 8),
      mkAssign('e1', 1, 'st_morning', 'r1', 8),
      mkAssign('e2', 0, 'st_morning', 'r2', 8),
      mkAssign('e2', 1, 'st_morning', 'r2', 8),
    ]
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_morning'] },
      { employee_id: 'e1', period_id: 'p1', day_of_week: 1, is_off: false, preferred_shift_ids: ['st_morning'] },
      { employee_id: 'e2', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_morning'] },
      { employee_id: 'e2', period_id: 'p1', day_of_week: 1, is_off: false, preferred_shift_ids: ['st_morning'] },
    ]
    const result = computeTwoRequestsHonored(assignments, requests, employees)
    expect(result.count).toBe(2)
    expect(result.total).toBe(2)
  })

  it('returns 0/0 when no employees at all', () => {
    const result = computeTwoRequestsHonored([], [], [])
    expect(result.count).toBe(0)
    expect(result.total).toBe(0)
  })
})
