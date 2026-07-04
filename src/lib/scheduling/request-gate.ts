// Request-preservation gate for the coverage-preserving diversity post-pass.
//
// Requests rank ABOVE fairness, so the diversity pass must NEVER sacrifice a
// satisfied request. A move (swap or rotation) is accepted only if, for every
// involved employee, it does not LOWER their satisfied-request count and does
// not push them BELOW their request floor (the ≥2 floor, capped at how many
// requests they actually made: floor target = min(2, theirRequestCount)).
//
// Satisfaction is recomputed from `input.requests` vs the PROPOSED assignments,
// so it stays correct after occupants are exchanged. Pure & deterministic.
import type { Assignment, EngineInput } from './types'

/** How many of `emp`'s daily preferred shifts are met by these assignments. */
export function satisfiedCount(
  input: EngineInput,
  empId: string,
  assignments: Assignment[],
): number {
  const reqs = input.requests[empId]
  if (!reqs) return 0
  let n = 0
  for (const a of assignments) {
    const r = reqs[a.day]
    if (r && r.preferred.includes(a.shift)) n++
  }
  return n
}

/** Total distinct preferred (day,shift) requests this employee made for the week. */
export function requestCount(input: EngineInput, empId: string): number {
  const reqs = input.requests[empId]
  if (!reqs) return 0
  let n = 0
  for (const day of Object.keys(reqs).map(Number)) {
    n += reqs[day].preferred.length
  }
  return n
}

/** The floor target for an employee: "at least half" of their requests, never
 *  below the legacy ≥2 floor: max(min(2, rc), ceil(rc / 2)). For rc ≤ 4 this
 *  equals the old min(2, rc); rc ≥ 5 raises it to ceil(rc / 2) so a heavy
 *  requester is guaranteed half their requests, not just two. */
export function floorTarget(input: EngineInput, empId: string): number {
  const rc = requestCount(input, empId)
  return Math.max(Math.min(2, rc), Math.ceil(rc / 2))
}

/**
 * Per-employee request-floor ordering key for the candidate comparator. Returns
 * < 0 when `a` outranks `b`.
 * (1) A requester still BELOW its own floor outranks one that met its floor —
 *     even at equal satisfied counts and even if `b`'s floor is lower.
 * (2) Among below-floor requesters, fewer satisfied first (drives first requests).
 * (3) Requesters that both met their floor tie here (extras go to fairness).
 * With both floors = 2 this reproduces the legacy min(satisfied, 2) ordering.
 */
export function compareFloorProgress(
  aSatisfied: number,
  aFloor: number,
  bSatisfied: number,
  bFloor: number,
): number {
  const aBelow = aSatisfied < aFloor ? 0 : 1
  const bBelow = bSatisfied < bFloor ? 0 : 1
  if (aBelow !== bBelow) return aBelow - bBelow
  if (aBelow === 0 && aSatisfied !== bSatisfied) return aSatisfied - bSatisfied
  return 0
}

/**
 * Would changing one employee's assignments from `before` to `after` preserve
 * requests? Accept only if satisfied count does NOT drop AND we never fall
 * below the floor target if we were at/above it before (a move may not push an
 * employee below min(2, requestCount)).
 */
export function preservesRequestsFor(
  input: EngineInput,
  empId: string,
  before: Assignment[],
  after: Assignment[],
): boolean {
  const sBefore = satisfiedCount(input, empId, before)
  const sAfter = satisfiedCount(input, empId, after)
  if (sAfter < sBefore) return false
  const floor = floorTarget(input, empId)
  // Never drop below the floor target if we already met it.
  if (sBefore >= floor && sAfter < floor) return false
  return true
}
