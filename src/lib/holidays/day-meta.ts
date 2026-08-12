/**
 * Pure helper: build per-day holiday metadata for a 7-day week.
 * No IO — takes a Set<string> of holiday date strings (YYYY-MM-DD).
 * Engine semantics:
 *   isHoliday[d]    = weekDates[d] ∈ holidayDates
 *   isHolidayEve[d] = (weekDates[d] + 1 day) ∈ holidayDates
 */

import { addDaysISO } from '@/lib/dates/week'

export interface HolidayDayMeta {
  isHoliday: boolean
  isHolidayEve: boolean
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
      isHolidayEve: holidayDates.has(addDaysISO(date, 1)),
    }
  })
}
