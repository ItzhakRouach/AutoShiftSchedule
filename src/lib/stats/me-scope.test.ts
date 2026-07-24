import { describe, it, expect } from 'vitest'
import { matchesStatScope } from './me-summary-data'

// Today Fri 2026-07-24: current week 07-19, current month 2026-07, year 2026.
const ctx = { weekTarget: '2026-07-19', monthKey: '2026-07', yearKey: '2026' }

describe('matchesStatScope', () => {
  it('week matches only the current schedule week', () => {
    expect(matchesStatScope('2026-07-19', 'week', ctx)).toBe(true)
    expect(matchesStatScope('2026-07-26', 'week', ctx)).toBe(false) // upcoming week
    expect(matchesStatScope('2026-07-12', 'week', ctx)).toBe(false) // prior week
  })

  it('month includes an upcoming same-month week but excludes the next month', () => {
    expect(matchesStatScope('2026-07-19', 'month', ctx)).toBe(true)
    expect(matchesStatScope('2026-07-26', 'month', ctx)).toBe(true)  // upcoming, still July
    expect(matchesStatScope('2026-07-05', 'month', ctx)).toBe(true)  // earlier July
    expect(matchesStatScope('2026-08-02', 'month', ctx)).toBe(false) // August
    expect(matchesStatScope('2026-06-28', 'month', ctx)).toBe(false) // June
  })

  it('year includes every same-year week (incl. upcoming) but excludes other years', () => {
    expect(matchesStatScope('2026-07-19', 'year', ctx)).toBe(true)
    expect(matchesStatScope('2026-08-02', 'year', ctx)).toBe(true)  // upcoming, still 2026
    expect(matchesStatScope('2026-01-04', 'year', ctx)).toBe(true)
    expect(matchesStatScope('2025-12-28', 'year', ctx)).toBe(false)
    expect(matchesStatScope('2027-01-03', 'year', ctx)).toBe(false)
  })

  it('nests: a week in scope for "week" is also in "month" and "year"', () => {
    for (const scope of ['week'] as const) {
      expect(matchesStatScope('2026-07-19', scope, ctx)).toBe(true)
    }
    expect(matchesStatScope('2026-07-19', 'month', ctx)).toBe(true)
    expect(matchesStatScope('2026-07-19', 'year', ctx)).toBe(true)
  })
})
