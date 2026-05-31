import { describe, it, expect } from 'vitest'
import { aggregateKPIs, coverageColor } from './aggregate'

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
    const kpis = aggregateKPIs([], [], employees, { filled: 8, required: 10 }, [])
    expect(kpis.coveragePct).toBe(80)
    expect(kpis.coverageColor).toBe('amber')
    expect(kpis.filledSlots).toBe(8)
    expect(kpis.requiredSlots).toBe(10)
  })

  it('handles zero requirements without divide-by-zero (null coverage)', () => {
    const kpis = aggregateKPIs([], [], employees, { filled: 0, required: 0 }, [])
    expect(kpis.coveragePct).toBeNull()
    expect(kpis.uncoveredSlots).toBe(0)
  })

  it('handles null requirementSummary', () => {
    const kpis = aggregateKPIs([], [], employees, null, [])
    expect(kpis.coveragePct).toBeNull()
    expect(kpis.uncoveredSlots).toBe(0)
  })

  it('computes uncoveredSlots = required − filled', () => {
    const kpis = aggregateKPIs([], [], employees, { filled: 7, required: 10 }, [])
    expect(kpis.uncoveredSlots).toBe(3)
  })

  it('uncoveredSlots is 0 when filled >= required', () => {
    const kpis = aggregateKPIs([], [], employees, { filled: 12, required: 10 }, [])
    expect(kpis.uncoveredSlots).toBe(0)
  })

  it('counts 12h fallback shifts in shifts12h', () => {
    const periodAssignments = [
      mkAssign('e1', 0, 'st12', 'r1', 12, true),
      mkAssign('e1', 1, 'st8', 'r1', 8, false),
      mkAssign('e2', 0, 'st12', 'r2', 12, true),
    ]
    const kpis = aggregateKPIs(periodAssignments, periodAssignments, employees, null, [])
    expect(kpis.shifts12h).toBe(2)
  })

  it('counts employees below min_shifts_per_week', () => {
    // e1 min=3 gets 1 shift → below; e2 min=2 gets 2 shifts → OK
    const periodAssignments = [
      mkAssign('e1', 0, 'st1', 'r1', 8),
      mkAssign('e2', 0, 'st1', 'r2', 8),
      mkAssign('e2', 1, 'st1', 'r2', 8),
    ]
    const kpis = aggregateKPIs(periodAssignments, periodAssignments, employees, null, [])
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
    const kpis = aggregateKPIs(periodAssignments, periodAssignments, employees, null, [])
    expect(kpis.belowMinCount).toBe(0)
  })

  it('computes requestHonoredPct across all non-off requests', () => {
    const periodAssignments = [
      mkAssign('e1', 0, 'st_morning', 'r1', 8),
      mkAssign('e2', 0, 'st_night', 'r2', 8),
    ]
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_morning'] },
      { employee_id: 'e2', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_morning'] },
    ]
    const kpis = aggregateKPIs(periodAssignments, periodAssignments, employees, null, requests)
    expect(kpis.requestHonoredPct).toBe(50)
  })

  it('requestHonoredPct is null when no non-off requests exist', () => {
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: true, preferred_shift_ids: null },
    ]
    const kpis = aggregateKPIs([], [], employees, null, requests)
    expect(kpis.requestHonoredPct).toBeNull()
  })

  it('requestHonoredPct null for empty preferred_shift_ids (divide-by-zero guard)', () => {
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: [] },
    ]
    const kpis = aggregateKPIs([], [], employees, null, requests)
    expect(kpis.requestHonoredPct).toBeNull()
  })

  it('sums totalHours from allAssignments', () => {
    const all = [
      mkAssign('e1', 0, 'st1', 'r1', 8),
      mkAssign('e2', 0, 'st1', 'r2', 12),
    ]
    const kpis = aggregateKPIs([], all, employees, null, [])
    expect(kpis.totalHours).toBe(20)
    expect(kpis.activeEmployees).toBe(2)
  })
})
