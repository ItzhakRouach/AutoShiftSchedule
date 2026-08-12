// Objective functions for the diversity post-pass (pure, deterministic).
// Tiers (higher = stronger), each ~1000× the next so they act lexicographically
// at realistic team scale (per-tier magnitudes < ~1000):
//   1. rest/night  — avoid 8-8-8 / 16h-first + night threshold (top priority)
//   2. role split  — even distribution of each role across its holders
//   3. diversity   — type-variety + co-worker rotation (spread + repeat)
//   4. unpopSpread — night/weekend balance tiebreaker
import type { Assignment, Employee } from './types'
import { typeSpread, unpopularLoad, restPenalty, nightOverage } from './fairness'
import { DEFAULT_NIGHT_CAP } from './night-targets'

const W_REST_NIGHT = 1_000_000_000
const W_ROLE_SPLIT = 1_000_000

/** Per-role even-split penalty: Σ over roles (with ≥2 holders) of the spread
 *  (max−min) of that role's shift counts across its holders. 0 ⇒ each role is
 *  split as evenly as possible among the people who hold it. Holders with 0 of
 *  the role count as 0. Single-role weeks are unaffected by swaps (role counts
 *  can't change), so this only ever helps multi-role distribution. Pure. */
export function roleSplitCost(
  employees: Employee[],
  committed: Record<string, Assignment[]>,
): number {
  const holders = new Map<string, string[]>()
  for (const e of employees) {
    for (const r of e.roleIds) {
      const list = holders.get(r) ?? []
      list.push(e.id)
      holders.set(r, list)
    }
  }
  let total = 0
  for (const [role, ids] of holders) {
    if (ids.length < 2) continue
    const counts = ids.map((id) => (committed[id] ?? []).filter((a) => a.roleId === role).length)
    total += Math.max(...counts) - Math.min(...counts)
  }
  return total
}

/**
 * Soft optimisation knobs for the post-pass. When omitted (the legacy 2-arg
 * call shape used by older tests), the rest/night terms contribute ZERO — the
 * cost is byte-for-byte the original (spread+repeat)*1000 + unpopSpread. The
 * production pass always supplies them (see runDiversityPass).
 */
export interface DiversityOpts {
  /** Ideal rest hours (16). When set, tight turnarounds are penalised. */
  idealRestHours?: number
  /** Per-employee night threshold; missing entries fall back to DEFAULT_NIGHT_CAP.
   *  Use Infinity to exempt (night-only workers / requested-beyond-cap). */
  nightThreshold?: Record<string, number>
  /** When true, add the per-role even-split term (roleSplitCost). */
  balanceRoles?: boolean
}

/** Global monotony objective: Σ per-employee type-spread (dim 2) + co-worker
 *  repetition penalty (dim 4), plus opt-in rest-quality + night-threshold
 *  penalties (top tier). Lower = better. Pure. */
export function diversityCost(
  employees: Employee[],
  committed: Record<string, Assignment[]>,
  opts: DiversityOpts = {},
): number {
  let spread = 0
  for (const e of employees) spread += typeSpread(committed[e.id] ?? [])
  const groups = new Map<string, string[]>()
  for (const e of employees) {
    for (const a of committed[e.id] ?? []) {
      const key = `${a.day}|${a.shift}`
      const list = groups.get(key) ?? []
      list.push(e.id)
      groups.set(key, list)
    }
  }
  const pairCount = new Map<string, number>()
  for (const ids of groups.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [x, y] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]]
        const k = `${x}|${y}`
        pairCount.set(k, (pairCount.get(k) ?? 0) + 1)
      }
    }
  }
  let repeat = 0
  for (const c of pairCount.values()) repeat += Math.max(0, c - 1)
  // Low-weight night/weekend (dim 3) spread guard: keeps the move set from
  // worsening unpopular-load balance while chasing type/co-worker diversity.
  // Weighted below 1 so it only separates moves that tie on the primary terms.
  const loads = employees.map((e) => unpopularLoad(committed[e.id] ?? []))
  const unpopSpread = loads.length ? Math.max(...loads) - Math.min(...loads) : 0

  // Opt-in top tier: rest quality (avoid 8-8-8 / prefer 16h) + night threshold.
  let restNight = 0
  if (opts.idealRestHours != null) {
    for (const e of employees) restNight += restPenalty(committed[e.id] ?? [], opts.idealRestHours)
  }
  if (opts.nightThreshold != null) {
    for (const e of employees) {
      const cap = opts.nightThreshold[e.id] ?? DEFAULT_NIGHT_CAP
      restNight += nightOverage(committed[e.id] ?? [], cap)
    }
  }

  const roleSplit = opts.balanceRoles ? roleSplitCost(employees, committed) : 0

  return (
    restNight * W_REST_NIGHT +
    roleSplit * W_ROLE_SPLIT +
    (spread + repeat) * 1000 +
    unpopSpread
  )
}
