import type { ScheduleView } from '@/lib/schedule/view-data'

/**
 * Days (0–6) on which `employeeId` already holds an assignment — base (view.grid)
 * or 12h (view.twelve). Used to block re-placing a held worker on a day they
 * already work (one shift/day), matching the server-side rule.
 */
export function busyDaysOf(view: ScheduleView, employeeId: string): Set<number> {
  const days = new Set<number>()
  for (let d = 0; d < 7; d++) {
    const byShift = view.grid[d] ?? {}
    for (const byRole of Object.values(byShift)) {
      for (const ids of Object.values(byRole)) {
        if (ids.includes(employeeId)) { days.add(d); break }
      }
    }
  }
  for (const t of view.twelve) if (t.employeeId === employeeId) days.add(t.day)
  return days
}

// Full Hebrew weekday names by index (0 = Sunday … 6 = Saturday), matching
// `DayInfo.index`. Used only for the cell's screen-reader label — the visible
// header uses the shorter `DayInfo.short` form.
const DAY_NAMES_FULL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

/** "<day>, <shift>, <role>: <names | לא מאויש>" for the cell's aria-label. */
export function buildCellLabel(
  dayIndex: number,
  shiftName: string,
  roleName: string,
  entries: { employeeId: string; tempName?: string }[],
  empById: Map<string, { name: string }>,
  covered: boolean,
): string {
  const names = entries
    .map((e) => e.tempName ?? empById.get(e.employeeId)?.name)
    .filter((n): n is string => !!n)
  const who = names.length > 0 ? names.join(', ') : covered ? 'מאויש ע״י משמרת 12 שעות' : 'לא מאויש'
  return `${DAY_NAMES_FULL[dayIndex] ?? ''}, ${shiftName}, ${roleName}: ${who}`
}
