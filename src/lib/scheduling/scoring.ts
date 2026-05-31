// Soft-objective candidate scoring. Lower comparator output = higher priority.
import type { Assignment, EmploymentType, Employee } from './types'

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
 * Candidate precedence (FIX 4 — explicit, per the user's rule). Lower comparator
 * output = HIGHER priority. The order, highest first, is EXACTLY:
 *   1. mustAccept-requested  (their off is already hard; their request wins).
 *   2. Employment tier: full (0) < part (1) < student (2)  — full-time FIRST.
 *   3. Requested-this-shift   (requested before non-requested).
 *   4. >=2-floor rank         (fewer satisfied requests first — see floorRank).
 *   5. Below min-shifts first.
 *   6. Fewer total assigned shifts (load balance).
 *   7. Lottery rank (FIX 1) as the final deterministic tie-break.
 *
 * NOTE: per the user's explicit instruction "always fill full-time first, then
 * part-time, then student", employment tier (2) outranks request status (3): a
 * full-time non-requester beats a part-time requester for a scarce slot.
 */
export function compareCandidates(a: CandidateState, b: CandidateState): number {
  // 1. mustAccept requested wins outright.
  const am = a.mustAcceptRequested ? 0 : 1
  const bm = b.mustAcceptRequested ? 0 : 1
  if (am !== bm) return am - bm

  // 2. employment-type ordering (full > part > student).
  const ae = EMPLOYMENT_RANK[a.emp.employmentType]
  const be = EMPLOYMENT_RANK[b.emp.employmentType]
  if (ae !== be) return ae - be

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

  // 5. reach min shifts: under-min first.
  const au = a.current.length < a.emp.minShifts ? 0 : 1
  const bu = b.current.length < b.emp.minShifts ? 0 : 1
  if (au !== bu) return au - bu

  // 6. fewer total shifts so far.
  if (a.current.length !== b.current.length) {
    return a.current.length - b.current.length
  }

  // 7. deterministic lottery tie-break.
  return a.lotteryRank - b.lotteryRank
}

/** Employees with 0 satisfied requests rank above those with 1, then 2+. */
export function floorRank(satisfied: number): number {
  if (satisfied <= 0) return 0
  if (satisfied === 1) return 1
  return 2
}
