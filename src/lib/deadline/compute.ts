/**
 * Deadline computation helpers — pure, deterministic (take `now` as param).
 *
 * Formula: deadlineDate = weekStart − 7 days + dow, at wall-clock `time` in `timeZone`.
 * e.g. weekStart=Sun 2026-06-07, dow=4 Thu, time='18:00', tz='Asia/Jerusalem'
 *   → 2026-06-04 (Thu) 18:00 IDT = 2026-06-04T15:00:00Z
 */
import { DateTime } from 'luxon'

const DEFAULT_TZ = 'Asia/Jerusalem'

/**
 * Returns a UTC Date representing the request deadline for the week period,
 * computed in `timeZone` so the wall-clock time is correct regardless of
 * where the server runs.
 *
 * @param weekStartISO  ISO date string of the period's week_start_date (a Sunday)
 * @param dow           Day-of-week for the deadline (0=Sun … 6=Sat)
 * @param time          Wall-clock time string "HH:MM" in `timeZone`
 * @param timeZone      IANA timezone (default 'Asia/Jerusalem')
 */
export function deadlineDateTime(
  weekStartISO: string,
  dow: number,
  time: string,
  timeZone: string = DEFAULT_TZ,
): Date {
  const [hStr, mStr] = time.split(':')
  const hour = parseInt(hStr, 10)
  const minute = parseInt(mStr, 10)

  // deadline date = weekStart − 7 days + dow
  const weekStart = DateTime.fromISO(weekStartISO, { zone: timeZone })
  const deadlineDate = weekStart.minus({ days: 7 }).plus({ days: dow })
  const deadlineDT = deadlineDate.set({ hour, minute, second: 0, millisecond: 0 })

  return deadlineDT.toUTC().toJSDate()
}

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

/**
 * Human-readable Hebrew label for the request deadline, e.g.
 * "יום חמישי, 4.6 בשעה 18:00". Computed from the same formula as deadlineDateTime.
 */
export function deadlineLabel(
  weekStartISO: string,
  dow: number,
  time: string,
  timeZone: string = DEFAULT_TZ,
): string {
  const weekStart = DateTime.fromISO(weekStartISO, { zone: timeZone })
  const d = weekStart.minus({ days: 7 }).plus({ days: dow })
  return `יום ${HEB_DAYS[dow] ?? ''}, ${d.day}.${d.month} בשעה ${time}`
}

/**
 * Returns true if `now` is strictly AFTER the deadline (i.e. deadline has passed).
 */
export function isPastDeadline(
  now: Date,
  weekStartISO: string,
  dow: number,
  time: string,
  timeZone: string = DEFAULT_TZ,
): boolean {
  const deadline = deadlineDateTime(weekStartISO, dow, time, timeZone)
  return now.getTime() > deadline.getTime()
}
