/**
 * True when two inclusive date ranges [aFrom, aTo] and [bFrom, bTo] share at
 * least one day. Dates are ISO strings (YYYY-MM-DD), which sort lexically the
 * same as chronologically, so plain string comparison is enough — no Date
 * parsing/timezone concerns.
 *
 * Bounds are INCLUSIVE on both sides: a range ending the same day another one
 * starts (aTo === bFrom) DOES overlap (they both claim that day).
 *
 * Args may be passed in either order — the ranges don't need aFrom <= bFrom.
 */
export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo
}
