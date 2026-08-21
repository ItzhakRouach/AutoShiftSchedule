/**
 * Calendar-boundary start dates for the week/month/year statistics scopes.
 * Returns the FIRST ISO date (YYYY-MM-DD, local time) included in each scope, so
 * callers filter `week_start_date >= scopeStartISO(scope)`:
 *   week  → this week's Sunday
 *   month → the 1st of this month
 *   year  → Jan 1 of this year
 * Boundaries nest (year ≤ month ≤ week), so a single year-range fetch is a
 * superset the month/week breakdowns can filter within.
 *
 * Replaces the old rolling `today − 7/31/365 days` windows, which collapsed
 * month & year to "all history" whenever a workplace's history was shorter than
 * the window. Local-time throughout, matching the rest of `src/lib/dates/`.
 */
import type { Scope } from '@/lib/stats/types'
import { currentWeekStartISO, toISODate } from './week'

export function scopeStartISO(scope: Scope, now: Date): string {
  if (scope === 'week') return currentWeekStartISO(now)
  if (scope === 'month') return toISODate(new Date(now.getFullYear(), now.getMonth(), 1))
  return toISODate(new Date(now.getFullYear(), 0, 1))
}

/**
 * Half-open [startISO, endISO) bounds of the period containing `anchorISO`
 * (YYYY-MM-DD). Unlike `scopeStartISO`, this bounds BOTH ends, so a past
 * month/year selected in the dashboard picker shows only its own data. Week
 * anchors are assumed to already be the period's Sunday (as stored in
 * `schedule_periods.week_start_date`).
 */
export function scopeRangeISO(scope: Scope, anchorISO: string): { startISO: string; endISO: string } {
  const [y, m, d] = anchorISO.split('-').map(Number)
  if (scope === 'week') {
    return { startISO: anchorISO, endISO: toISODate(new Date(y, m - 1, d + 7)) }
  }
  if (scope === 'month') {
    return {
      startISO: toISODate(new Date(y, m - 1, 1)),
      endISO: toISODate(new Date(y, m, 1)),
    }
  }
  return { startISO: toISODate(new Date(y, 0, 1)), endISO: toISODate(new Date(y + 1, 0, 1)) }
}
