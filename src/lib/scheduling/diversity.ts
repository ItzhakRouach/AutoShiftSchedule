// Coverage-preserving diversity post-pass (pure, deterministic). Finishes the
// two SLOT-SPECIFIC fairness dimensions a per-DAY employee ordering cannot fully
// control:
//   2. Shift-type variety per employee (don't strand someone on one type).
//   4. Co-worker rotation (vary who works alongside whom).
//
// MECHANISM. After the 8h general fill, repeatedly look for an improving move
// over the occupants of already-filled 8h cells: a 2-SWAP (exchange occupants
// of two cells) or a 3-CYCLE rotation (rotate occupants among three cells). A
// move keeps every slot filled (coverage is byte-for-byte identical — only WHO
// fills each cell changes) and is applied ONLY when (a) every mover stays legal
// under all 8 hard constraints in their new cell, (b) it does NOT reduce any
// involved employee's satisfied-request count nor push them below the ≥2 floor
// (request-gate — requests rank above fairness), and (c) it STRICTLY lowers the
// global monotony objective. A CANONICAL iteration order (sort by employee id,
// then day/shift/role) makes the result identical regardless of input ordering;
// a strict-decrease rule + a fixed pass cap guarantee termination. Swaps never
// change any employee's total shift count, so even-load, reach-min, requested
// and the request floor are all preserved.
//
// CO-WORKER definition: two employees "worked together" iff assigned to the SAME
// day AND SAME shift. The repetition penalty is the number of EXTRA shared
// shifts beyond the first for each pair (Σ over pairs of max(0, sharedCount−1)).
import type { Assignment, DayMeta, Employee, EngineInput, ShiftKey } from './types'
import type { FillState } from './dayfill'
import { typeSpread, unpopularLoad, restPenalty, nightOverage } from './fairness'
import { plain, moveLegal, applyMove, projectedCommitted, type SlotRef, type Move } from './moves'

const MAX_PASSES = 24

/** Default night soft-cap: no worker should pull more than 3 nights/week. */
export const DEFAULT_NIGHT_CAP = 3

// Objective tiers (higher = stronger), each ~1000× the next so they act
// lexicographically at realistic team scale (per-tier magnitudes < ~1000):
//   1. rest/night  — avoid 8-8-8 / 16h-first + ≤3 nights (top priority)
//   2. role split  — even distribution of each role across its holders
//   3. diversity    — type-variety + co-worker rotation (spread + repeat)
//   4. unpopSpread  — night/weekend balance tiebreaker
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
  /** Per-employee night soft-cap; missing entries fall back to DEFAULT_NIGHT_CAP.
   *  Use Infinity to exempt (night-only workers / requested-beyond-cap). */
  nightThreshold?: Record<string, number>
  /** When true, add the per-role even-split term (roleSplitCost). */
  balanceRoles?: boolean
}

/** Global monotony objective: Σ per-employee type-spread (dim 2) + co-worker
 *  repetition penalty (dim 4), plus opt-in rest-quality + night-cap penalties
 *  (top tier). Lower = better. Pure. */
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

  // Opt-in top tier: rest quality (avoid 8-8-8 / prefer 16h) + night soft-cap.
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

/** True when an employee can ONLY ever work night shifts (availability map
 *  present and every listed day allows night and nothing else). Such workers are
 *  exempt from the night cap — they have no other option. */
function nightOnlyAvailable(emp: Employee): boolean {
  const avail = emp.availability
  if (!avail) return false
  const days = Object.keys(avail)
  if (days.length === 0) return false
  for (const d of days) {
    const allowed = avail[Number(d)] ?? []
    if (allowed.length === 0) continue
    if (allowed.some((s) => s !== 'night')) return false
  }
  return true
}

/** Per-employee night soft-cap: Infinity (exempt) for night-only workers, else
 *  max(DEFAULT_NIGHT_CAP, nights they explicitly requested) — a worker who asked
 *  for 4 nights may have 4 without penalty. */
export function buildNightThresholds(input: EngineInput): Record<string, number> {
  const map: Record<string, number> = {}
  for (const e of input.employees) {
    if (nightOnlyAvailable(e)) {
      map[e.id] = Infinity
      continue
    }
    const reqs = input.requests[e.id] ?? {}
    let requestedNights = 0
    for (const day of Object.keys(reqs)) {
      const pref = reqs[Number(day)]?.preferred ?? ([] as ShiftKey[])
      if (pref.includes('night')) requestedNights++
    }
    map[e.id] = Math.max(DEFAULT_NIGHT_CAP, requestedNights)
  }
  return map
}

/** All plain-8h SlotRefs in CANONICAL order: employee id, then day, shift, role.
 *  This is what makes the pass reorder-invariant w.r.t. input.employees order. */
function canonicalSlots(st: FillState): SlotRef[] {
  const refs: SlotRef[] = []
  const ids = Object.keys(st.committed).sort()
  for (const empId of ids) {
    const list = st.committed[empId]
    const indexed = list
      .map((a, idx) => ({ a, idx }))
      .filter((x) => plain(x.a))
      .sort((p, q) =>
        p.a.day - q.a.day ||
        (p.a.shift < q.a.shift ? -1 : p.a.shift > q.a.shift ? 1 : 0) ||
        (p.a.roleId < q.a.roleId ? -1 : p.a.roleId > q.a.roleId ? 1 : 0),
      )
    for (const { a, idx } of indexed) refs.push({ empId, idx, a })
  }
  return refs
}

/** Cells of a move must be on distinct days (constraint 7) and not a pure no-op
 *  (some occupant must end on a different shift/role). Distinct employees too. */
function moveShape(legs: SlotRef[]): boolean {
  const n = legs.length
  const days = new Set(legs.map((l) => l.a.day))
  const emps = new Set(legs.map((l) => l.empId))
  if (days.size !== n || emps.size !== n) return false
  let changes = false
  for (let k = 0; k < n; k++) {
    const to = legs[(k + 1) % n].a
    if (legs[k].a.shift !== to.shift || legs[k].a.roleId !== to.roleId) changes = true
  }
  return changes
}

/** Evaluate one candidate move; returns its cost if legal+request-preserving+
 *  strictly improving, else null. Deterministic (no mutation of st). */
function scoreMove(
  input: EngineInput,
  metas: Record<number, DayMeta>,
  st: FillState,
  move: Move,
  before: number,
  opts: DiversityOpts,
): number | null {
  if (!moveShape(move.legs)) return null
  if (!moveLegal(input, metas, st, move)) return null
  const after = diversityCost(input.employees, projectedCommitted(st, move), opts)
  return after < before ? after : null
}

/** The single best (lowest-cost, then earliest in canonical order) improving
 *  move this pass, considering 2-swaps and 3-cycles. */
function bestMove(
  input: EngineInput,
  metas: Record<number, DayMeta>,
  st: FillState,
  refs: SlotRef[],
  before: number,
  maxCycle: number,
  opts: DiversityOpts,
): Move | null {
  const acc: { move: Move; cost: number }[] = []
  const consider = (move: Move): void => {
    const cost = scoreMove(input, metas, st, move, before, opts)
    if (cost === null) return
    const top = acc[0]
    if (!top || cost < top.cost) acc[0] = { move, cost }
  }
  const n = refs.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      consider({ legs: [refs[i], refs[j]] })
    }
  }
  // 3-cycles in canonical (i<j<k) order; both rotation directions evaluated.
  if (maxCycle >= 3) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          consider({ legs: [refs[i], refs[j], refs[k]] })
          consider({ legs: [refs[i], refs[k], refs[j]] })
        }
      }
    }
  }
  return acc[0]?.move ?? null
}

/**
 * Run the coverage-preserving diversity post-pass, mutating `st`. Repeats a
 * canonical scan applying the single best strictly-improving, legal,
 * request-preserving move (swap or 3-cycle) each pass, until no improvement or
 * the pass cap. Deterministic regardless of input.employees ordering.
 */
export function runDiversityPass(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
  maxCycle = 3,
): void {
  // Production opts: enable the rest-quality (16h-first / anti-8-8-8) and night
  // soft-cap terms so coverage-preserving swaps also fix tight turnarounds and
  // over-cap night loads wherever a legal swap allows.
  const opts: DiversityOpts = {
    idealRestHours: input.settings.idealRestHours,
    nightThreshold: buildNightThresholds(input),
    balanceRoles: true,
  }
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const before = diversityCost(input.employees, st.committed, opts)
    const refs = canonicalSlots(st)
    const move = bestMove(input, metas, st, refs, before, maxCycle, opts)
    if (!move) break
    applyMove(st, move)
  }
}
