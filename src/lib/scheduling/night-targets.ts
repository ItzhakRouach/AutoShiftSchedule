// Even night-distribution targets (pure, deterministic). Computes a per-worker
// night threshold so nights spread evenly across the ELIGIBLE pool:
//   T = ceil((total − requestedNights) / |non-requesters|) — every explicitly
//   requested night is carried by its requester (requests win), the remainder
//   spreads over the non-requesters (or the full pool when everyone requested).
//   Workers who cannot or must not take nights are excluded from the pool.
// Thresholds feed the night-unload pass and the diversity cost (strong
// preference — hard constraints and coverage always win).
import type { Assignment, Employee, EngineInput, NightImbalance, Requirements } from './types'
import { nightCount } from './fairness'

/** Fallback night soft-cap when no target can be computed. */
export const DEFAULT_NIGHT_CAP = 3

/** True when an employee is only ever available for NIGHT (and optionally
 *  EVENING = noon, 15–23) shifts — i.e. their availability map lists nothing
 *  but noon/night, and includes at least one night. Such workers are exempt
 *  from the night cap: per policy, "max 2–3 nights unless the worker's
 *  availability is only nights and evening". They have little else to work. */
export function nightOnlyAvailable(emp: Employee): boolean {
  const avail = emp.availability
  if (!avail) return false
  const days = Object.keys(avail)
  if (days.length === 0) return false
  let hasNight = false
  for (const d of days) {
    const allowed = avail[Number(d)] ?? []
    for (const s of allowed) {
      if (s === 'night') hasNight = true
      else if (s !== 'noon') return false // a morning (or other) shift → not exempt
    }
  }
  return hasNight
}

/** Total required night slots across all days and roles. */
export function countRequiredNights(requirements: Requirements): number {
  let total = 0
  for (const d of Object.keys(requirements)) {
    const roleCounts = requirements[Number(d)]?.night
    if (!roleCounts) continue
    for (const role of Object.keys(roleCounts)) total += roleCounts[role]
  }
  return total
}

/** Roles that have at least one required night slot this week. */
function nightRoles(requirements: Requirements): Set<string> {
  const roles = new Set<string>()
  for (const d of Object.keys(requirements)) {
    const roleCounts = requirements[Number(d)]?.night
    if (!roleCounts) continue
    for (const role of Object.keys(roleCounts)) {
      if (roleCounts[role] > 0) roles.add(role)
    }
  }
  return roles
}

/** Days on which the employee explicitly requested a night shift. */
function requestedNights(input: EngineInput, empId: string): number {
  const reqs = input.requests[empId] ?? {}
  let n = 0
  for (const day of Object.keys(reqs)) {
    if ((reqs[Number(day)]?.preferred ?? []).includes('night')) n++
  }
  return n
}

function nightAvailabilityAllows(emp: Employee): boolean {
  if (emp.availability == null) return true
  return Object.values(emp.availability).some((allowed) => (allowed ?? []).includes('night'))
}

/** Workers among whom nights should be divided evenly: availability permits a
 *  night, they hold a role with required nights, and they are NOT a must_accept
 *  worker without night requests (those never work unrequested nights). */
export function nightEligible(input: EngineInput): string[] {
  const roles = nightRoles(input.requirements)
  return input.employees
    .filter(
      (e) =>
        nightAvailabilityAllows(e) &&
        e.roleIds.some((r) => roles.has(r)) &&
        !(e.mustAccept && requestedNights(input, e.id) === 0),
    )
    .map((e) => e.id)
}

/** Per-employee night threshold: Infinity (exempt) for night-only workers, else
 *  max(T, nights they explicitly requested) with T the even-division target.
 *  Falls back to DEFAULT_NIGHT_CAP when there are no required nights or no
 *  eligible workers. */
export function buildNightThresholds(input: EngineInput): Record<string, number> {
  const total = countRequiredNights(input.requirements)
  const pool = nightEligible(input)
  const fallback = total === 0 || pool.length === 0

  let target = DEFAULT_NIGHT_CAP
  if (!fallback) {
    // Requesters carry ALL the nights they asked for (their threshold is
    // max(T, requested) below), so the even-division target only needs to
    // spread the remainder across the non-requesters. Spreading over the full
    // pool would double-count requested nights and over-cap total capacity.
    let requested = 0
    const nonRequesters: string[] = []
    for (const id of pool) {
      const req = requestedNights(input, id)
      if (req > 0) requested += req
      else nonRequesters.push(id)
    }
    const remaining = Math.max(0, total - requested)
    const spread = nonRequesters.length > 0 ? nonRequesters.length : pool.length
    target = Math.ceil(remaining / spread)
  }

  const map: Record<string, number> = {}
  for (const e of input.employees) {
    if (nightOnlyAvailable(e)) {
      map[e.id] = Infinity
      continue
    }
    map[e.id] = fallback ? DEFAULT_NIGHT_CAP : Math.max(target, requestedNights(input, e.id))
  }
  return map
}

/** Workers left above their (finite) night threshold after all rebalance
 *  passes — an even division was impossible without breaking hard constraints
 *  or coverage, so the manager is warned instead. */
export function computeNightImbalance(
  input: EngineInput,
  committed: Record<string, Assignment[]>,
): NightImbalance[] {
  const thresholds = buildNightThresholds(input)
  const out: NightImbalance[] = []
  for (const e of input.employees) {
    const target = thresholds[e.id]
    if (!Number.isFinite(target)) continue
    const nights = nightCount(committed[e.id] ?? [])
    if (nights > target) out.push({ employeeId: e.id, nights, target })
  }
  return out
}
