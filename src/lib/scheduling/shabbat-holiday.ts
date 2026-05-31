// Shabbat & holiday blocking rules (hard constraints 4 & 5).
import type { DayMeta, Employee, ShiftKey } from './types'

export const FRIDAY = 5
export const SATURDAY = 6

/**
 * Shabbat (observer): block Fri noon+night and Sat morning+noon.
 * Sat night (23:00) is ALLOWED.
 */
export function shabbatBlocks(day: number, shift: ShiftKey): boolean {
  if (day === FRIDAY) return shift === 'noon' || shift === 'night'
  if (day === SATURDAY) return shift === 'morning' || shift === 'noon'
  return false
}

/**
 * Holiday (observer): on isHolidayEve block noon+night; on isHoliday block
 * morning+noon. (Same pattern as Shabbat around the holiday.)
 */
export function holidayBlocks(meta: DayMeta, shift: ShiftKey): boolean {
  if (meta.isHolidayEve && (shift === 'noon' || shift === 'night')) return true
  if (meta.isHoliday && (shift === 'morning' || shift === 'noon')) return true
  return false
}

/** Combined Shabbat + holiday block check for an employee on a given day/shift. */
export function isSacredBlocked(
  emp: Employee,
  meta: DayMeta,
  shift: ShiftKey,
): boolean {
  if (emp.observesShabbat && shabbatBlocks(meta.index, shift)) return true
  if (emp.observesHolidays && holidayBlocks(meta, shift)) return true
  return false
}
