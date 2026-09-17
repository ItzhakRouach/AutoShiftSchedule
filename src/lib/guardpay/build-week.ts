/**
 * Pure builder: published-week assignments → GuardPay IMPORT_WEEK shifts.
 * All wall-clock math happens in Asia/Jerusalem (luxon handles DST), and the
 * payload carries true UTC instants — the same format the GuardPay app itself
 * stores (`Date.toISOString()`), so its salary logic prices them identically.
 */
import { DateTime } from 'luxon'
import type { GuardPayShift } from './types'
import { kippurOverlapHours, kippurWindowsForWeek, withoutKippurDates } from './kippur-hours'

const ZONE = 'Asia/Jerusalem'

export interface AssignmentRow {
  day_of_week: number
  shift_type_id: string
}

export interface ShiftTypeRow {
  id: string
  name: string
  start_hour: number
  hours: number
}

/** Stable idempotency key: re-importing the same week replaces, never duplicates. */
export function buildImportKey(weekStart: string): string {
  return `mishmeret:${weekStart}`
}

function dateOfDay(weekStart: string, dayOfWeek: number): DateTime {
  return DateTime.fromISO(weekStart, { zone: ZONE }).plus({ days: dayOfWeek })
}

export function buildWeekShifts(args: {
  weekStart: string
  assignments: AssignmentRow[]
  shiftTypesById: Record<string, ShiftTypeRow>
  holidaySet: Set<string>
}): GuardPayShift[] {
  const { weekStart, assignments, shiftTypesById, holidaySet } = args
  const out: GuardPayShift[] = []

  // Yom Kippur is priced by the fast window rather than the civil date (the
  // workplace pays 200% inside it, flat), so its dates are pulled out of the
  // chag set — otherwise a 23:00 shift hours after havdalah would still read as
  // a holiday. Everything else keeps the existing date-based rule.
  const kippurWindows = kippurWindowsForWeek(weekStart)
  const chagDates = withoutKippurDates(holidaySet, kippurWindows)

  for (const a of assignments) {
    const st = shiftTypesById[a.shift_type_id]
    if (!st) continue
    const day = dateOfDay(weekStart, a.day_of_week)
    const start = day.set({ hour: st.start_hour, minute: 0, second: 0, millisecond: 0 })
    const end = start.plus({ hours: st.hours })
    const date = day.toISODate()!
    const nextDate = day.plus({ days: 1 }).toISODate()!
    const startISO = start.toUTC().toISO()!
    const endISO = end.toUTC().toISO()!
    const kippurHours = kippurOverlapHours(startISO, endISO, kippurWindows)
    // GuardPay pays a chag like Shabbat, and its weekend window opens at 16:00
    // on the eve — mirror that: the chag date itself, or an erev-chag shift
    // starting 16:00+.
    const isChag = chagDates.has(date) || (st.start_hour >= 16 && chagDates.has(nextDate))
    out.push({
      start: startISO,
      end: endISO,
      // is_holiday also picks the payslip row's label ("חג" vs "שבת"), so a
      // shift touching the fast keeps it even though pricing is flat.
      isHoliday: isChag || kippurHours > 0,
      comment: `יובא ממשמרת · ${st.name}`,
      ...(kippurHours > 0 ? { kippurHours } : {}),
    })
  }

  out.sort((a, b) => a.start.localeCompare(b.start))
  return out
}
