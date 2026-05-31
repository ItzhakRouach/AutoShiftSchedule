/**
 * Deadline computation helpers — pure, deterministic (take `now` as param).
 *
 * Formula: deadlineDate = weekStart - 7 days + dow, at time.
 * e.g. weekStart=Sun 2026-06-07, dow=4 Thu, time='18:00'
 *   → 2026-06-07 - 7 = 2026-05-31 (prev Sun) + 4 = 2026-06-04 Thu @ 18:00
 */

/**
 * Returns a Date representing the request deadline for the week period.
 * @param weekStartISO  ISO date string of the period's week_start_date (a Sunday)
 * @param dow           Day-of-week for the deadline (0=Sun … 6=Sat)
 * @param time          Time string "HH:MM"
 */
export function deadlineDateTime(weekStartISO: string, dow: number, time: string): Date {
  const [hStr, mStr] = time.split(':')
  const hours = parseInt(hStr, 10)
  const minutes = parseInt(mStr, 10)

  // Parse the week start date in local time (avoid UTC offset issues)
  const [yyyy, mm, dd] = weekStartISO.split('-').map(Number)
  const weekStart = new Date(yyyy, mm - 1, dd)

  // deadline day = weekStart - 7 + dow
  const deadlineDay = new Date(weekStart)
  deadlineDay.setDate(weekStart.getDate() - 7 + dow)
  deadlineDay.setHours(hours, minutes, 0, 0)

  return deadlineDay
}

/**
 * Returns true if `now` is strictly AFTER the deadline (i.e. deadline has passed).
 */
export function isPastDeadline(
  now: Date,
  weekStartISO: string,
  dow: number,
  time: string,
): boolean {
  const deadline = deadlineDateTime(weekStartISO, dow, time)
  return now.getTime() > deadline.getTime()
}
