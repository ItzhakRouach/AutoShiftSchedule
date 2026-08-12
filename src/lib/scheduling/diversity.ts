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
import type { DayMeta, EngineInput } from './types'
import type { FillState } from './dayfill'
import { plain, moveLegal, applyMove, projectedCommitted, type SlotRef, type Move } from './moves'
import { buildNightThresholds } from './night-targets'
import { diversityCost, type DiversityOpts } from './diversity-cost'

export { buildNightThresholds, DEFAULT_NIGHT_CAP } from './night-targets'
export { diversityCost, roleSplitCost, type DiversityOpts } from './diversity-cost'

const MAX_PASSES = 24

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
  let best: { move: Move; cost: number } | null = null
  const consider = (move: Move): void => {
    const cost = scoreMove(input, metas, st, move, before, opts)
    if (cost === null) return
    if (!best || cost < best.cost) best = { move, cost }
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
  // Assertion: TS can't see the closure assignment in `consider` and narrows
  // `best` to its `null` initializer.
  return (best as { move: Move; cost: number } | null)?.move ?? null
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
