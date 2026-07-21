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
