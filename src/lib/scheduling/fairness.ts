// Fairness & diversity SOFT objectives (pure, deterministic). These rank BELOW
// the hard constraints and the higher soft objectives (mustAccept → reach-min →
// requested → ≥2-request floor) and ABOVE the final lottery tie-break. They are
// preferences only and NEVER change which slots can be filled (coverage is
// preserved). Four dimensions:
//   1. Even shift-count distribution — `load` (dominant weight).
//   2. Shift-type variety per employee — `typeSpread` (max−min of by-type counts).
//   3. Night/weekend fairness — `unpopularLoad` (nights + Fri/Sat already held).
//   4. Co-worker rotation — handled by the slot-specific post-pass (see below).
//
// Dims 1 & 3 (and a nudge for 2) are folded into a single deterministic
// `fairnessScore` consumed by `compareCandidates`. Dims 2 & 4 are slot-specific
// (they depend on the exact target shift / co-workers) so they cannot be fully
// expressed by a per-DAY employee ordering; the coverage-preserving post-pass in
// `diversity.ts` finishes those by swapping assignments between employees only
// when every hard constraint stays satisfied and coverage is identical.
import type { Assignment, ShiftKey } from './types'
import { BASE_SHIFTS } from './types'

/** Friday = index 5, Saturday = index 6 are the unpopular weekend days. */
export const WEEKEND_DAYS = new Set<number>([5, 6])

/** Per-employee morning/noon/night counts from a committed assignment list. */
export function byType(current: Assignment[]): Record<ShiftKey, number> {
  const t: Record<ShiftKey, number> = { morning: 0, noon: 0, night: 0 }
  for (const a of current) t[a.shift]++
  return t
}

/** How many of these shifts are "unpopular": a night, OR on Fri/Sat (any shift). */
export function unpopularLoad(current: Assignment[]): number {
  let n = 0
  for (const a of current) {
    if (a.shift === 'night' || WEEKEND_DAYS.has(a.day)) n++
  }
  return n
}

/** Monotony of an employee's shift-type mix: (max − min) of the by-type counts.
 *  0 = perfectly even across the three types; larger = more concentrated. */
export function typeSpread(current: Assignment[]): number {
  const t = byType(current)
  const counts = BASE_SHIFTS.map((s) => t[s])
  return Math.max(...counts) - Math.min(...counts)
}

// Weights — `load` dominates so even-distribution stays the primary fairness
// signal (dim 1); unpopular-load is the next strongest (dim 3); type-spread is a
// gentle nudge (dim 2). All integer so the score is exact and deterministic, and
// the comparator output stays an integer. Chosen so load can never be overturned
// by the lower terms within realistic weekly counts (≤ ~14 shifts, spread ≤ ~5).
export const W_LOAD = 100
export const W_UNPOPULAR = 8
export const W_SPREAD = 3

/**
 * Deterministic fairness score for an employee given their committed shifts.
 * LOWER = higher priority to receive the next shift. Combines even-distribution
 * (load), night/weekend fairness (unpopularLoad) and shift-type variety nudge
 * (typeSpread). Pure function of `current` — no randomness; lottery stays last.
 */
export function fairnessScore(current: Assignment[]): number {
  return (
    W_LOAD * current.length +
    W_UNPOPULAR * unpopularLoad(current) +
    W_SPREAD * typeSpread(current)
  )
}
