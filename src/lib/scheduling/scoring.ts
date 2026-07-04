// Soft-objective candidate scoring. Lower comparator output = higher priority.
import type { Assignment, EmploymentType, Employee } from './types'
import { fairnessScore } from './fairness'
import { compareFloorProgress } from './request-gate'

/** Employment-type priority: full-time first, then part-time, then student. */
export const EMPLOYMENT_RANK: Record<EmploymentType, number> = {
  full: 0,
  part: 1,
  student: 2,
}

/** True when the employee's legal-slot set this week is restricted by an
 *  explicit availability map OR by Shabbat/holiday observance. Tight-availability
 *  employees have fewer slots they CAN take, so within below-min they need to
 *  reserve their slots BEFORE unrestricted employees consume those same slots
 *  — otherwise they get squeezed out and miss their minimum. */
export function hasTightAvailability(emp: Employee): boolean {
  return emp.availability !== null || emp.observesShabbat || emp.observesHolidays
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
  /** this employee's OWN request floor (floorTarget = max(min(2,rc), ceil(rc/2))).
   *  Requesters still below their own floor are prioritized over those who met it,
   *  driving the "at least half of your requests" guarantee. Defaults to 0. */
  floorTarget?: number
  /** deterministic lottery rank (0 = drawn first); lower wins */
  lotteryRank: number
  /** is this employee a SENIOR holder for the role(s) in play for this match?
   *  Senior holders are favored for their role's shifts over regular holders
   *  (soft — ranks below requests, above general fairness). Defaults false, so
   *  with no seniority configured this key never separates candidates. */
  seniorForRole?: boolean
}

/** True when the employee is a senior holder for the given role name. */
export function isSeniorForRole(emp: Employee, roleId: string): boolean {
  return emp.seniorRoleIds?.includes(roleId) ?? false
}

/**
 * Canonical candidate precedence. Lower comparator output = HIGHER priority.
 * The order, highest first, is EXACTLY:
 *   1. mustAccept-requested.
 *   2. Reach-minimum: below-min ranks above at-min. Among below-min, sub-keys:
 *        (2a) higher priorDeficit first — cross-week minimum fairness;
 *        (2b) tight-availability first — employees restricted by Shabbat/holiday
 *             observance or an explicit availability map need their min reserved
 *             before unrestricted employees consume the few legal slots they
 *             share; otherwise restricted employees end up squeezed below their
 *             minimum while unrestricted employees collect extras;
 *        (2c) employment tier full(0) < part(1) < student(2).
 *      None of these sub-keys are consulted once an employee has reached min.
 *   3. Requested-this-shift.
 *   4. >=2-request floor.
 *   5. Fairness (fairnessScore): priorExtras dominant (cross-week extras
 *      fairness: who worked above-min last week receives fewer extras this
 *      week) + even load + night/weekend + shift-type-variety nudge. Applies
 *      to extras for ALL employees with no tier preference.
 *   6. Lottery rank.
 *
 * Consequence: a below-min full-timer beats a part-time requester (step 2);
 * but a below-min Shabbat-observing or availability-restricted employee beats
 * a below-min unrestricted full-timer (step 2b) so the restricted employee
 * reaches min before the unrestricted one collects extras. Above min, extras
 * are distributed fairly across ALL employees via fairnessScore — no tier
 * preference between full/part/student for extras.
 */
export function compareCandidates(
  a: CandidateState,
  b: CandidateState,
  requestFirst = false,
): number {
  // 1. mustAccept requested wins outright.
  const am = a.mustAcceptRequested ? 0 : 1
  const bm = b.mustAcceptRequested ? 0 : 1
  if (am !== bm) return am - bm

  // HYBRID request priority (used ONLY by the request-reservation pre-pass):
  // a requested shift outranks reaching ANOTHER worker's minimum, so explicit
  // requests are honored. The general fill keeps the default order (reach-min
  // first), and the reservation only grabs a slot when no OTHER requester
  // outranks — and the later reach-min/general fill still pursues minimums on
  // the remaining slots, so a minimum only yields when a request truly contends.
  if (requestFirst) {
    const ar0 = a.requested ? 0 : 1
    const br0 = b.requested ? 0 : 1
    if (ar0 !== br0) return ar0 - br0
    if (a.requested && b.requested) {
      const fc = compareFloorProgress(
        a.requestsSatisfied, a.floorTarget ?? 0,
        b.requestsSatisfied, b.floorTarget ?? 0,
      )
      if (fc !== 0) return fc
    }
  }

  // 2. reach-minimum. below-min ranks above at-min (bucket). Among below-min ONLY,
  // sub-order by: (2a) higher carry-over priorDeficit first — cross-week fairness,
  // so employees short-changed last week are filled toward their minimum first;
  // (2b) tight-availability first — restricted employees grab their constrained
  // slots before unrestricted employees take them; (2c) employment tier
  // (full > part > student) among equally-tight equally-deficit below-min
  // candidates. None of these sub-keys are consulted once an employee has
  // reached their minimum (bucket collapses).
  const aBelow = isBelowMin(a)
  const bBelow = isBelowMin(b)
  if (aBelow !== bBelow) return aBelow ? -1 : 1
  if (aBelow && bBelow) {
    // 2a. carry-over deficit: more-deficit employee first (descending → negate).
    const dd = priorDeficitOf(b) - priorDeficitOf(a)
    if (dd !== 0) return dd
    // 2b. tight-availability first (0 = tight wins, 1 = unrestricted).
    const at = hasTightAvailability(a.emp) ? 0 : 1
    const bt = hasTightAvailability(b.emp) ? 0 : 1
    if (at !== bt) return at - bt
    // 2c. employment tier among equally-tight equally-deficit below-min employees.
    const ar = EMPLOYMENT_RANK[a.emp.employmentType]
    const br = EMPLOYMENT_RANK[b.emp.employmentType]
    if (ar !== br) return ar - br
  }

  // 3. requested over not-requested.
  const ar = a.requested ? 0 : 1
  const br = b.requested ? 0 : 1
  if (ar !== br) return ar - br

  // 4. request-satisfaction floor: requesters still BELOW their own floor
  // (floorTarget = "at least half", never < 2) rank ahead of those who met it;
  // among below-floor, fewer satisfied first. Drives the per-employee floor.
  if (a.requested && b.requested) {
    const fc = compareFloorProgress(
      a.requestsSatisfied, a.floorTarget ?? 0,
      b.requestsSatisfied, b.floorTarget ?? 0,
    )
    if (fc !== 0) return fc
  }

  // 4.5 senior-for-role preference: among candidates still tied (same request
  // status/floor), a SENIOR holder of the role in play is favored over a regular
  // holder, so seniors tend to receive that role's shifts first while regulars
  // split the rest. Inert (no separation) when no seniority is configured.
  const as = a.seniorForRole ? 0 : 1
  const bs = b.seniorForRole ? 0 : 1
  if (as !== bs) return as - bs

  // 5. fairness: deterministic fairnessScore (priorExtras dominant + even load
  // + night/weekend fairness + shift-type-variety nudge). Lower = higher priority.
  // Applies to extras for ALL employees — no tier preference between
  // full/part/student. Cross-week extras fairness lives in priorExtras: whoever
  // worked above-min last published week receives fewer extras this week.
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

