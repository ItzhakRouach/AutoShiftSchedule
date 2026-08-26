/**
 * Pure publish-timing helpers — deterministic, take `now` as a param.
 * Uses the same Israel-tz pattern as src/lib/deadline/compute.ts.
 */
import { DateTime } from 'luxon'
import { addDaysISO, todayInIsraelISO, upcomingWeekStartFromISO } from '@/lib/dates/week'

const DEFAULT_TZ = 'Asia/Jerusalem'

/**
 * Returns true when "today" (in Israel tz) matches `publishDow` AND
 * the current wall-clock time is ≥ `publishTime`.
 *
 * @param now         Current UTC instant
 * @param publishDow  Day-of-week to publish (0=Sun … 6=Sat)
 * @param publishTime Wall-clock time string "HH:MM" in Israel tz
 * @param timeZone    IANA timezone (default 'Asia/Jerusalem')
 */
export function isPublishDue(
  now: Date,
  publishDow: number,
  publishTime: string,
  timeZone: string = DEFAULT_TZ,
): boolean {
  const local = DateTime.fromJSDate(now, { zone: timeZone })

  // Luxon weekday: Mon=1 … Sun=7; convert from our 0=Sun..6=Sat format
  const localDow = local.weekday === 7 ? 0 : local.weekday // 0=Sun

  if (localDow !== publishDow) return false

  const [hStr, mStr] = publishTime.split(':')
  const hour = parseInt(hStr, 10)
  const minute = parseInt(mStr, 10)

  const nowMinutes = local.hour * 60 + local.minute
  const targetMinutes = hour * 60 + minute
  return nowMinutes >= targetMinutes
}

/** Never auto-publish weeks older than this — an abandoned/stale period from
 *  weeks ago must not suddenly go public on the next cron tick. */
export const MAX_RETRO_DAYS = 14

/**
 * The week_start_date window the auto-publish cron may touch, computed on the
 * Israel wall clock: from MAX_RETRO_DAYS back up to the UPCOMING Sunday.
 * The upper bound is the fix for the 21.8 incident — when the imminent week is
 * already manager-published, "earliest unpublished period" must NOT reach into
 * next week's half-built draft (it would go public before its request deadline).
 */
export function autoPublishWindow(now: Date): { minWeek: string; maxWeek: string } {
  const todayISO = todayInIsraelISO(now)
  return {
    minWeek: addDaysISO(todayISO, -MAX_RETRO_DAYS),
    maxWeek: upcomingWeekStartFromISO(todayISO),
  }
}
