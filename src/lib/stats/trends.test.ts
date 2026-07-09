import { describe, it, expect } from 'vitest'
import { buildWeeklyTrends } from './trends'

const keyById = new Map([
  ['st_m', 'morning'],
  ['st_n', 'night'],
  ['st_12n', 'm12_night'],
])

const mk = (period_id: string, employee_id: string, day_of_week: number, shift_type_id: string) => ({
  period_id, employee_id, day_of_week, shift_type_id, role_id: 'r1', hours: 8, is_fallback: false,
})

describe('buildWeeklyTrends', () => {
  const periods = [
    { id: 'p2', week_start_date: '2026-07-12' },
    { id: 'p1', week_start_date: '2026-07-05' },
  ]

  it('sorts oldest → newest and computes coverage per week', () => {
    const assignments = [mk('p1', 'e1', 0, 'st_m'), mk('p2', 'e1', 0, 'st_m'), mk('p2', 'e2', 1, 'st_n')]
    const t = buildWeeklyTrends(periods, assignments, [], 4, keyById)
    expect(t.map((x) => x.weekStart)).toEqual(['2026-07-05', '2026-07-12'])
    expect(t[0].coveragePct).toBe(25) // 1/4
    expect(t[1].coveragePct).toBe(50) // 2/4
  })

  it('coverage null when no weekly requirement; capped at 100', () => {
    const t = buildWeeklyTrends(periods, [mk('p1', 'e1', 0, 'st_m')], [], 0, keyById)
    expect(t[0].coveragePct).toBeNull()
    const t2 = buildWeeklyTrends([periods[1]], [mk('p1', 'e1', 0, 'st_m'), mk('p1', 'e2', 1, 'st_m')], [], 1, keyById)
    expect(t2[0].coveragePct).toBe(100)
  })

  it('honored rate per week counts 12h covers + granted offs', () => {
    const assignments = [mk('p1', 'e1', 0, 'st_12n')] // covers noon+night on day 0
    const requests = [
      { employee_id: 'e1', period_id: 'p1', day_of_week: 0, is_off: false, preferred_shift_ids: ['st_n'] }, // honored (covered)
      { employee_id: 'e2', period_id: 'p1', day_of_week: 3, is_off: true, preferred_shift_ids: [] },        // honored (off granted)
      { employee_id: 'e1', period_id: 'p1', day_of_week: 2, is_off: false, preferred_shift_ids: ['st_m'] }, // not honored
    ]
    const t = buildWeeklyTrends([periods[1]], assignments, requests, 10, keyById)
    expect(t[0].honoredPct).toBe(67) // 2 of 3
  })

  it('night count includes 12h-night variants; honored null with no requests', () => {
    const t = buildWeeklyTrends([periods[1]], [mk('p1', 'e1', 0, 'st_12n'), mk('p1', 'e2', 2, 'st_n')], [], 10, keyById)
    expect(t[0].nightShifts).toBe(2)
    expect(t[0].honoredPct).toBeNull()
  })
})
