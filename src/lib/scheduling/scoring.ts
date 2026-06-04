// Soft-objective candidate scoring. Lower comparator output = higher priority.
import type { Assignment, EmploymentType, Employee } from './types'
import { fairnessScore } from './fairness'

/** Employment-type priority: full-time first, then part-time, then student. */
export const EMPLOYMENT_RANK: Record<EmploymentType, number> = {
  full: 0,
  part: 1,
  student: 2,
}

/** Reversed employment-type priority for extras (at/above-min only): part wins,
 *  then student, then full. Higher full-time floor pushes them to take extras
 *  LAST — i.e. only after part-time and student have headroom-to-max consumed. */
export const EXTRAS_TIER_RANK: Record<EmploymentType, number> = {
  part: 0,
  student: 1,
  full: 2,
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
 * Canonical candidate precedence. Lower comparator output = HIGHER priority.
 * The order, highest first, is EXACTLY:
 *   1. mustAccept-requested.
 *   2. Reach-minimum, carry-over- then tier-ordered: below-min ranks above
 *      at-min; among below-min, (2a) higher priorDeficit first, then (2b)
 *      employment tier full(0) < part(1) < student(2). Tier matters ONLY
 *      until min is met.
 *   3. Requested-this-shift.
 *   4. >=2-request floor.
 *   4.5. Extras-by-tier (at/above-min ONLY): employment tier REVERSED —
 *        part(0) < student(1) < full(2). Steers extras toward part/student
 *        before full-timers; activates only when both candidates are at/above
 *        their minimum.
 *   5. Fairness (fairnessScore): priorExtras dominant + even load + night /
 *      weekend + shift-type-variety nudge.
 *   6. Lottery rank.
 *
 * Consequence: a below-min full-timer beats a part-time requester (step 2);
 * an at-min full-timer loses to an at-min part-timer for extras (step 4.5),
 * and among at-min full-timers competing for extras, whoever had FEWER extras
 * in the prior published period wins (step 5 priorExtras).
 */
export function compareCandidates(a: CandidateState, b: CandidateState): number {
  // 1. mustAccept requested wins outright.
  const am = a.mustAcceptRequested ? 0 : 1
  const bm = b.mustAcceptRequested ? 0 : 1
  if (am !== bm) return am - bm

  // 2. reach-minimum. below-min ranks above at-min (bucket). Among below-min ONLY,
  // sub-order by: (2a) higher carry-over priorDeficit first — cross-week fairness,
  // so employees short-changed last week are filled toward their minimum first;
  // then (2b) employment tier (full > part > student). Neither sub-key is
  // consulted once an employee has reached their minimum (bucket collapses).
  const aBelow = isBelowMin(a)
  const bBelow = isBelowMin(b)
  if (aBelow !== bBelow) return aBelow ? -1 : 1
  if (aBelow && bBelow) {
    // 2a. carry-over deficit: more-deficit employee first (descending → negate).
    const dd = priorDeficitOf(b) - priorDeficitOf(a)
    if (dd !== 0) return dd
    // 2b. employment tier among equally-deficit below-min employees.
    const at = EMPLOYMENT_RANK[a.emp.employmentType]
    const bt = EMPLOYMENT_RANK[b.emp.employmentType]
    if (at !== bt) return at - bt
  }

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

  // 4.5. extras-by-tier (at/above-min only). When both candidates have already
  // reached their minimum (step 2 collapsed them into the same bucket), reverse
  // the employment tier so part-time/student receive remaining open slots
  // BEFORE full-timers fill extras. This activates only when there are open
  // slots to fill — once part/student hit their own maxShifts they drop out of
  // the candidate pool naturally. Untouched: below-min logic in step 2.
  if (!aBelow && !bBelow) {
    const ax = EXTRAS_TIER_RANK[a.emp.employmentType]
    const bx = EXTRAS_TIER_RANK[b.emp.employmentType]
    if (ax !== bx) return ax - bx
  }

  // 5. fairness: deterministic fairnessScore (priorExtras dominant + even load
  // + night/weekend fairness + shift-type-variety nudge). Lower = higher priority.
  const aFair = fairnessScore(a.current, priorExtrasOf(a))
  const bFair = fairnessScore(b.current, priorExtrasOf(b))
  if (aFair !== bFair) return aFair - bFair

  // 6. deterministic lottery tie-break.
  return a.lotteryRank - b.lotteryRank
}

/** Has this employee NOT yet reached their weekly minimum given current load? */
export function isBelowMin(c: CandidateState): boolean {
  return c.current.length < c.emp.minShifts
}

/** Carry-over shortfall from the most-recent published period (>=0, default 0). */
export function priorDeficitOf(c: CandidateState): number {
  return Math.max(0, c.emp.priorDeficit ?? 0)
}

/** Carry-over above-min count from the most-recent published period (>=0, default 0). */
export function priorExtrasOf(c: CandidateState): number {
  return Math.max(0, c.emp.priorExtras ?? 0)
}

/**
 * Combined reach-minimum + tier key. Below-min employees sort ahead of at-min
 * ones; among below-min, the employment tier (full=0, part=1, student=2) orders
 * them. At/above-min employees all collapse to the same (largest) bucket so tier
 * no longer separates them. Lower = higher priority.
 *
 * NOTE: the LIVE precedence in compareCandidates ALSO sub-orders below-min
 * employees by carry-over priorDeficit (higher first) BEFORE tier; this helper
 * keeps the deficit-agnostic tier ordering for reference/back-compat.
 */
export function reachMinRank(c: CandidateState): number {
  if (!isBelowMin(c)) return EMPLOYMENT_RANK.student + 1
  return EMPLOYMENT_RANK[c.emp.employmentType]
}

/** Employees with 0 satisfied requests rank above those with 1, then 2+. */
export function floorRank(satisfied: number): number {
  if (satisfied <= 0) return 0
  if (satisfied === 1) return 1
  return 2
}
