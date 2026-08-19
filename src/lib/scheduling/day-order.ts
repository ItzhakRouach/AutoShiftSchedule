// Fill-order policy: hard-to-staff days (Shabbat/holiday-constrained) are
// filled before regular weekdays, so scarce worker capacity (max-shifts, rest
// windows) is spent on the days with the smallest candidate pool first.
import type { DayMeta } from './types'

const FRIDAY = 5
const SATURDAY = 6

export function isHardDay(d: DayMeta): boolean {
  return d.index === FRIDAY || d.index === SATURDAY || d.isHoliday || d.isHolidayEve
}

/** Hard days first, then the rest — each group in chronological order. Pure. */
export function prioritizeDays(days: DayMeta[]): DayMeta[] {
  return [...days.filter(isHardDay), ...days.filter((d) => !isHardDay(d))]
}
