// Soft-objective candidate scoring. Lower comparator output = higher priority.
import type { Assignment, EmploymentType, Employee } from './types'
import { fairnessScore } from './fairness'

/** Employment-type priority: full-time first, then part-time, then student. */
export const EMPLOYMENT_RANK: Record<EmploymentType, number> = {
  full: 0,
  part: 1,
  student: 2,
}

export interface CandidateState {
  emp: Employee
  /** did this employee request this shift today? */
  requested: boolean
  /** is this employee mustAccept and requested it? (top request priority) */
  mustAcceptRequested: boolean
  current: Assignment[]
  /** how many of this employee's requests are satisfied so far */
  requestsSatisfied: number
  /** deterministic lottery rank (0 = drawn first); lower wins */
  lotteryRank: number
}

/**
 * Canonical candidate precedence (FIX A — final product decision). Lower
 * comparator output = HIGHER priority. The order, highest first, is EXACTLY:
 *   1. mustAccept-requested      (their off is already hard; their request wins).
 *   2. Reach-minimum, tier-ordered: an employee BELOW their minShifts ranks above
 *      one who has reached it; among below-min employees ONLY, employment tier
 *      full(0) < part(1) < student(2). This is the ONLY place tier matters — and
 *      only until min is met. Once at/above min, tier grants no priority.
 *   3. Requested-this-shift      (requester before non-requester).
 *   4. >=2-request floor         (fewer satisfied requests first — see floorRank).
 *   5. Fairness (deterministic fairnessScore): even shift-count distribution
 *      (dominant), night/weekend fairness, and a shift-type-variety nudge.
 *   6. Lottery rank (FIX 1)      (final deterministic tie-break).
 *
 * Consequence: a below-min full-timer beats a part-time requester (step 2), but
 * an at-min full-timer loses to a part-time requester (step 3 decides).
 */
export function compareCandidates(a: CandidateState, b: CandidateState): number {
  // 1. mustAccept requested wins outright.
  const am = a.mustAcceptRequested ? 0 : 1
  const bm = b.mustAcceptRequested ? 0 : 1
  if (am !== bm) return am - bm

  // 2. reach-minimum, tier-ordered. below-min ranks above at-min; among
  // below-min, employment tier (full > part > student) breaks the tie. Tier is
  // intentionally NOT consulted once an employee has reached their minimum.
  const ar2 = reachMinRank(a)
  const br2 = reachMinRank(b)
  if (ar2 !== br2) return ar2 - br2

  // 3. requested over not-requested.
  const ar = a.requested ? 0 : 1
  const br = b.requested ? 0 : 1
  if (ar !== br) return ar - br

  // 4. request-satisfaction floor: fewer satisfied requests first (below 2,
  // then below 1). Applied among requesters to drive the >=2 (else >=1) floor.
  if (a.requested && b.requested) {
    const af = floorRank(a.requestsSatisfied)
    const bf = floorRank(b.requestsSatisfied)
    if (af !== bf) return af - bf
  }

  // 5. fairness: deterministic fairnessScore (even load dominant + night/weekend
  // fairness + shift-type-variety nudge). Lower score = higher priority.
  const af = fairnessScore(a.current)
  const bf = fairnessScore(b.current)
  if (af !== bf) return af - bf

  // 6. deterministic lottery tie-break.
  return a.lotteryRank - b.lotteryRank
}

/**
 * Combined reach-minimum + tier key. Below-min employees sort ahead of at-min
 * ones; among below-min, the employment tier (full=0, part=1, student=2) orders
 * them. At/above-min employees all collapse to the same (largest) bucket so tier
 * no longer separates them. Lower = higher priority.
 */
export function reachMinRank(c: CandidateState): number {
  const belowMin = c.current.length < c.emp.minShifts
  if (!belowMin) return EMPLOYMENT_RANK.student + 1
  return EMPLOYMENT_RANK[c.emp.employmentType]
}

/** Employees with 0 satisfied requests rank above those with 1, then 2+. */
export function floorRank(satisfied: number): number {
  if (satisfied <= 0) return 0
  if (satisfied === 1) return 1
  return 2
}
