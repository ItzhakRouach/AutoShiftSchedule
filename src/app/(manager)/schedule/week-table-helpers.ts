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
