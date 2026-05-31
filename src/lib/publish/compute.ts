/**
 * Pure publish-timing helpers — deterministic, take `now` as a param.
 * Uses the same Israel-tz pattern as src/lib/deadline/compute.ts.
 */
import { DateTime } from 'luxon'

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
