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

/** The floor target for an employee: min(2, their request count) — matches the
 *  engine's ≥2 (else ≥1, else 0) request floor. */
export function floorTarget(input: EngineInput, empId: string): number {
  return Math.min(2, requestCount(input, empId))
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
