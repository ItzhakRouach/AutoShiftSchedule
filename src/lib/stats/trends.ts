// PURE per-week trend series for the dashboard (month/year scopes): coverage,
// request-honored rate, and night count per published week. No IO — testable.
import type { AssignmentRow } from './aggregate'
import { NIGHT_SHIFT_KEYS } from './aggregate'
import { groupRequestsByEmployee, indexAssignments, reqIsHonored } from './aggregate-index'

interface PeriodRef {
  id: string
  week_start_date: string
}

interface RequestRow {
  employee_id: string
  period_id: string
  day_of_week: number
  is_off: boolean
  preferred_shift_ids: string[] | null
}

export interface WeeklyTrend {
  periodId: string
  /** YYYY-MM-DD of the week's Sunday. */
  weekStart: string
  /** filled/required % (capped at 100); null when no weekly requirement is set. */
  coveragePct: number | null
  /** honored real-requests % across the roster; null when nobody asked. */
  honoredPct: number | null
  nightShifts: number
}

/**
 * One point per period, oldest → newest. `weeklyRequired` is the workplace's
 * per-week required headcount total (shift_requirements is week-shaped, so the
 * same target applies to every period).
 */
export function buildWeeklyTrends(
  periods: PeriodRef[],
  assignments: (AssignmentRow & { period_id: string })[],
  requests: RequestRow[],
  weeklyRequired: number,
  keyById: Map<string, string>,
): WeeklyTrend[] {
  const sorted = [...periods].sort((a, b) => a.week_start_date.localeCompare(b.week_start_date))
  return sorted.map((p) => {
    const rows = assignments.filter((a) => a.period_id === p.id)
    const reqs = requests.filter((r) => r.period_id === p.id)

    const coveragePct = weeklyRequired > 0
      ? Math.min(100, Math.round((rows.length / weeklyRequired) * 100))
      : null

    const index = indexAssignments(rows, keyById)
    let asked = 0
    let honored = 0
    for (const empReqs of groupRequestsByEmployee(reqs).values()) {
      for (const r of empReqs) {
        asked++
        if (reqIsHonored(index, r.employee_id, r)) honored++
      }
    }
    const honoredPct = asked > 0 ? Math.round((honored / asked) * 100) : null

    let nightShifts = 0
    for (const a of rows) {
      if (NIGHT_SHIFT_KEYS.has(keyById.get(a.shift_type_id) ?? '')) nightShifts++
    }

    return { periodId: p.id, weekStart: p.week_start_date, coveragePct, honoredPct, nightShifts }
  })
}
