/**
 * Pure helper: build per-day holiday metadata for a 7-day week.
 * No IO — takes a Set<string> of holiday date strings (YYYY-MM-DD).
 * Engine semantics:
 *   isHoliday[d]    = weekDates[d] ∈ holidayDates
 *   isHolidayEve[d] = (weekDates[d] + 1 day) ∈ holidayDates
 */

export interface HolidayDayMeta {
  isHoliday: boolean
  isHolidayEve: boolean
}

/** Add `n` days to a YYYY-MM-DD string using UTC math. */
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  const yyyy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Returns 7-element array of HolidayDayMeta, one per week day.
 * `weekDates` must be exactly 7 YYYY-MM-DD strings in order.
 * `holidayDates` is the Set of holiday dates (from the DB or israeliChagDates).
 */
export function buildHolidayMeta(
  weekDates: readonly string[],
  holidayDates: Set<string>,
): HolidayDayMeta[] {
  return Array.from({ length: 7 }, (_, d) => {
    const date = weekDates[d]
    return {
      isHoliday: holidayDates.has(date),
      isHolidayEve: holidayDates.has(addDays(date, 1)),
    }
  })
}
