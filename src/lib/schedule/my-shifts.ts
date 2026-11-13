/**
 * The employee's own shifts as a week list + "next shift", for the home page.
 * Pure (no IO): rows in, display-ready days out. Times are resolved in the
 * workplace timezone so "today / tomorrow" follow the Israeli wall clock even
 * on a UTC server.
 */
import { DateTime } from 'luxon'
import { formatShiftTime } from '@/lib/domain/meta'

export interface ShiftTypeLike {
  id: string
  key: string
  name: string
  color: string | null
  start_hour: number
  hours: number
}

export interface MyAssignmentRow {
  day_of_week: number
  shift_type_id: string
  role_id: string | null
}

export interface MyShift {
  dateISO: string
  dayIndex: number
  shiftKey: string
  name: string
  /** "07:00–15:00" */
  time: string
  color: string
  roleName: string
  hours: number
  startMs: number
  endMs: number
}

export interface MyDay {
  dateISO: string
  dayIndex: number
  shift: MyShift | null
}

export interface MyWeek {
  weekStart: string
  days: MyDay[]
  shiftCount: number
  hours: number
}

export function buildMyWeek(
  weekStart: string,
  rows: MyAssignmentRow[],
  shiftTypes: ShiftTypeLike[],
  roleNameById: Map<string, string>,
  zone: string,
): MyWeek {
  const typeById = new Map(shiftTypes.map((s) => [s.id, s]))
  const sunday = DateTime.fromISO(weekStart, { zone })
  const byDay = new Map<number, MyShift>()

  for (const r of rows) {
    const st = typeById.get(r.shift_type_id)
    if (!st || r.day_of_week < 0 || r.day_of_week > 6) continue
    const start = sunday.plus({ days: r.day_of_week, hours: st.start_hour })
    byDay.set(r.day_of_week, {
      dateISO: sunday.plus({ days: r.day_of_week }).toISODate()!,
      dayIndex: r.day_of_week,
      shiftKey: st.key,
      name: st.name,
      time: formatShiftTime(st.start_hour, st.hours),
      color: st.color ?? '#888888',
      roleName: (r.role_id && roleNameById.get(r.role_id)) || '',
      hours: st.hours,
      startMs: start.toMillis(),
      endMs: start.plus({ hours: st.hours }).toMillis(),
    })
  }

  const days: MyDay[] = Array.from({ length: 7 }, (_, i) => ({
    dateISO: sunday.plus({ days: i }).toISODate()!,
    dayIndex: i,
    shift: byDay.get(i) ?? null,
  }))
  const shifts = days.flatMap((d) => (d.shift ? [d.shift] : []))
  return { weekStart, days, shiftCount: shifts.length, hours: shifts.reduce((s, x) => s + x.hours, 0) }
}

/** The earliest shift that has not ended yet (an in-progress shift counts). */
export function pickNextShift(weeks: MyWeek[], nowMs: number): MyShift | null {
  const upcoming = weeks
    .flatMap((w) => w.days)
    .flatMap((d) => (d.shift && d.shift.endMs > nowMs ? [d.shift] : []))
    .sort((a, b) => a.startMs - b.startMs)
  return upcoming[0] ?? null
}

/** "היום" / "מחר" / "בעוד N ימים", by calendar day in the workplace timezone. */
export function whenLabel(shift: MyShift, nowMs: number, zone: string): string {
  if (shift.startMs <= nowMs && nowMs < shift.endMs) return 'עכשיו במשמרת'
  const today = DateTime.fromMillis(nowMs, { zone }).startOf('day')
  const day = DateTime.fromMillis(shift.startMs, { zone }).startOf('day')
  const diff = Math.round(day.diff(today, 'days').days)
  if (diff <= 0) return 'היום'
  if (diff === 1) return 'מחר'
  if (diff === 2) return 'בעוד יומיים'
  return `בעוד ${diff} ימים`
}

/** Drops weeks that have fully ended, keeping the week in progress and later ones. */
export function fromCurrentWeek(weeks: MyWeek[], nowMs: number, zone: string): MyWeek[] {
  return weeks
    .filter((w) => DateTime.fromISO(w.weekStart, { zone }).plus({ days: 7 }).toMillis() > nowMs)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}
