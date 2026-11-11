/**
 * Pure off-cap decision helpers shared by employee day-off request flows.
 * No I/O — callers (server actions) fetch the cap + usage counts and pass
 * them in here to decide whether a save is allowed.
 *
 * Contract for every cap parameter in this module: `null`/`undefined` means
 * "no limit configured", and a stored `0` (or negative) is treated as "no
 * limit" too, as defense-in-depth against a bad/uninitialized stored value —
 * neither ever blocks a request.
 */

/**
 * Whether saving this day-off request would breach the employee's weekly
 * off-day cap. `usedExcludingThisDay` is the employee's off-day count for
 * the week, not counting the day being saved (it counts as +1).
 */
export function weeklyCapBlocks(cap: number | null | undefined, usedExcludingThisDay: number): boolean {
  if (cap == null || cap <= 0) return false
  return usedExcludingThisDay + 1 > cap
}

/** Hebrew error message for a weekly off-cap breach. */
export function weeklyCapMessage(cap: number): string {
  return `הגעת למקסימום ימי חופש לשבוע (${cap})`
}

/**
 * Whether saving this day-off request would breach the workplace's per-day
 * off cap. `dayOffCount` is the count of OTHER employees already requesting
 * that day off; `>=` is correct because if others already fill the cap,
 * this save would push it over.
 */
export function perDayCapBlocks(cap: number | null | undefined, dayOffCount: number): boolean {
  if (cap == null || cap <= 0) return false
  return dayOffCount >= cap
}

/** Hebrew error message for a per-day off cap breach. */
export function perDayCapMessage(dayOffCount: number, cap: number): string {
  return `כבר ${dayOffCount} עובדים ביקשו חופש ביום זה — המכסה היומית (${cap}) מלאה`
}

// ── Request-day cap (any day with a request counts once) ─────────────────────

/** Minimal row shape shared by the employee + manager request readers. */
export interface RequestDayRow {
  is_off: boolean
  preferred_shift_ids: string[]
}

/**
 * How many DAYS carry a real request: off-marked OR at least one preferred
 * shift. A day with several options still counts once; junk empty rows
 * (`is_off=false`, no shifts — the manager path can persist those) count zero.
 */
export function countRequestDays(rows: RequestDayRow[]): number {
  let n = 0
  for (const r of rows) {
    if (r.is_off || (r.preferred_shift_ids?.length ?? 0) > 0) n += 1
  }
  return n
}

/**
 * Whether saving a NON-EMPTY request on a new day would breach the weekly
 * request-day cap. `unlimited` is the per-employee exemption flag;
 * `usedExcludingThisDay` counts the employee's OTHER request days this week.
 */
export function requestCapBlocks(
  cap: number | null | undefined,
  unlimited: boolean,
  usedExcludingThisDay: number,
): boolean {
  if (unlimited) return false
  return weeklyCapBlocks(cap, usedExcludingThisDay)
}

/** Hebrew error message for a weekly request-day cap breach. */
export function requestCapMessage(cap: number): string {
  return `ניתן לבקש עד ${cap} ימים בשבוע — הגעת למקסימום`
}

/**
 * UI twin of the server checks: is the cap reached for the day currently being
 * edited? The active day is excluded when it already counts toward `current`
 * (its save replaces itself), so editing/clearing an existing day never reads
 * as "reached". `null`/`<=0` cap → never reached.
 */
export function capReachedExcludingActive(
  cap: number | null | undefined,
  current: number,
  activeCounted: boolean,
): boolean {
  if (cap == null || cap <= 0) return false
  return current - (activeCounted ? 1 : 0) >= cap
}
