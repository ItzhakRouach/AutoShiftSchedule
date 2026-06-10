// Shared fill routine (FIX B): the SINGLE source of truth for how slots get
// staffed. Both generateSchedule and checkFeasibility run THIS, so feasibility
// can never disagree with the grid. Pure & deterministic.
import type { DayMeta, Employee, EngineInput } from './types'
import type { MatchSlot } from './matching'
import { lotteryRank } from './lottery'
import { emptyGrid } from './grid'
import { matchDay, isTopPrecedenceFor, type FillState } from './dayfill'
import { runTwelveFill } from './twelve-fill'
import { runDiversityPass, buildNightThresholds } from './diversity'
import { runNightUnloadPass } from './night-unload'
import { runCoverageRescue } from './coverage-rescue'
import { satisfiedCount as recountSatisfied } from './request-gate'

function reqOf(input: EngineInput, empId: string, day: number) {
  return input.requests[empId]?.[day] ?? { off: false, preferred: [] }
}

function metaMap(input: EngineInput): Record<number, DayMeta> {
  const m: Record<number, DayMeta> = {}
  for (const d of input.days) m[d.index] = d
  return m
}

/** A slot is "requested" by emp if it's in their preferred list that day. */
function requestsSlot(input: EngineInput, e: Employee, slot: MatchSlot): boolean {
  return reqOf(input, e.id, slot.day).preferred.includes(slot.shift)
}

/** Deterministic per-employee lottery ranks: pure fn of (seed, id) (FIX 1). */
function buildLotteryRanks(input: EngineInput): Record<string, number> {
  const ranks: Record<string, number> = {}
  for (const e of input.employees) ranks[e.id] = lotteryRank(input.seed, e.id)
  return ranks
}

/**
 * Request-honoring pre-pass (HYBRID policy). Reserves EVERY requested shift a
 * worker can legally take (one per day; rest / max / role / off all enforced by
 * isAssignable), using request-first precedence so an explicit request outranks
 * giving ANOTHER worker their minimum. A slot is reserved only when no OTHER
 * REQUESTER of that slot outranks this worker, so request-vs-request contention
 * is still resolved fairly. Minimums are pursued afterward (carry-over + general
 * fill) on the remaining slots, so a minimum only yields where a request truly
 * needs the slot.
 */
function honorRequestsRound(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
): void {
  for (const d of input.days) {
    const meta = metas[d.index]
    matchDay(
      input,
      meta,
      st,
      () => 1, // one shift/day; weekly accrual happens across days
      (e, slot) =>
        requestsSlot(input, e, slot) && isTopPrecedenceFor(input, meta, st, e, slot, true),
    )
  }
}

/**
 * Must-accept pre-pass: an employee flagged `mustAccept` has their requested
 * shifts honored above everyone else's. Runs FIRST, so their requested slots are
 * still open and they claim them before any other reservation/general fill — i.e.
 * a must-accept request overrides a competing employee's request for the same
 * slot. Only their REQUESTED slots are eligible (slotFilter), capacity 1/day, and
 * `isAssignable` still enforces the hard rules (rest, one-shift/day, max shifts,
 * role, Shabbat/holiday) — so genuinely-impossible requests are simply skipped.
 */
function mustAcceptRound(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
): void {
  if (!input.employees.some((e) => e.mustAccept)) return
  for (const d of input.days) {
    const meta = metas[d.index]
    matchDay(
      input,
      meta,
      st,
      (e) => (e.mustAccept ? 1 : 0),
      (e, slot) => e.mustAccept && requestsSlot(input, e, slot),
    )
  }
}

/**
 * Cross-week fairness pre-pass: reserve legal slots toward minShifts for
 * employees carrying a positive priorDeficit (short of their minimum LAST
 * published week), processed deficit-desc so the most short-changed fill first.
 * Coverage-preserving: it only commits a slot when the employee is the
 * top-precedence assignable candidate for it (so it never displaces a
 * higher-precedence employee), and `matchDay` only fills OPEN required slots —
 * so total filled slots are identical to a run without this pass; it merely
 * decides WHO occupies a contested slot. Off-requests stay hard (isAssignable).
 */
function carryOverRound(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
): void {
  const hasDeficit = input.employees.some((e) => (e.priorDeficit ?? 0) > 0)
  if (!hasDeficit) return
  for (const d of input.days) {
    const meta = metas[d.index]
    matchDay(
      input,
      meta,
      st,
      (e) => ((e.priorDeficit ?? 0) > 0 && st.committed[e.id].length < e.minShifts ? 1 : 0),
      (e, slot) => isTopPrecedenceFor(input, meta, st, e, slot),
    )
  }
}

function generalFill(input: EngineInput, st: FillState, metas: Record<number, DayMeta>): void {
  for (const d of input.days) {
    matchDay(input, metas[d.index], st, () => 1, () => true)
  }
}

/**
 * Run the engine's real fill and return the committed FillState. This is the
 * exact path generateSchedule uses; checkFeasibility reuses it so that
 * feasibility.maxStaffable == coverage.filledSlots ALWAYS.
 *
 * When `skipTwelve` is true the 12h auto-coverage pass is NOT run — used to
 * measure the 8h-ONLY staffable count so feasibility can tell "needs12h" (8h
 * short but 12h closes more) from "short" (12h cannot help). The default path
 * runs the full 8h + 12h fill.
 */
export function runFill(input: EngineInput, skipTwelve = false, skipDiversity = false): FillState {
  const st: FillState = {
    grid: emptyGrid(input),
    committed: {},
    satisfied: {},
    lotteryRank: buildLotteryRanks(input),
  }
  for (const e of input.employees) {
    st.committed[e.id] = []
    st.satisfied[e.id] = 0
  }
  const metas = metaMap(input)
  // MUST-ACCEPT FIRST: honor every feasible requested shift of must-accept
  // employees before any other reservation, so their requests win all contention.
  mustAcceptRound(input, st, metas)
  // HYBRID: honor every feasible requested shift (request-first precedence),
  // resolving only request-vs-request contention; minimums are pursued next.
  honorRequestsRound(input, st, metas)
  // CROSS-WEEK FAIRNESS: reserve toward minShifts for carry-over (under-served
  // last published week) employees, before general fill. Top-precedence-gated &
  // open-slot-only ⇒ coverage-preserving; off-requests remain hard.
  carryOverRound(input, st, metas)
  // FIX 2: general max-matching fill of all remaining required slots.
  generalFill(input, st, metas)
  // NIGHT CAP: same-day swaps pull anyone over their night cap (≤3, unless
  // night/evening-only or they requested the nights) back down. Coverage- and
  // request-preserving. Runs before diversity so the type/co-worker pass then
  // re-optimises around the final night distribution.
  if (!skipDiversity) {
    runNightUnloadPass(input, st, metas, buildNightThresholds(input))
  }
  // FAIRNESS dims 2 & 4: coverage-preserving diversity swaps (shift-type variety
  // + co-worker rotation). Swaps only — coverage & per-employee load unchanged.
  // `skipDiversity` (test-only) lets suites measure the pre-pass baseline.
  if (!skipDiversity) {
    runDiversityPass(input, st, metas)
    // The pass may move occupants onto/off requested cells; recompute satisfied
    // counts from the final committed state so stats stay accurate. (The pass
    // never lowers any employee's satisfied count — gated in request-gate.)
    for (const e of input.employees) {
      st.satisfied[e.id] = recountSatisfied(input, e.id, st.committed[e.id])
    }
  }
  // COVERAGE-RESCUE FIRST: fill remaining gaps with normal 8h shifts by reclaiming
  // the lowest-priority soft-off workers (vacation/רענון untouched; a senior's
  // off-request is honored over a junior's — see coverage-rescue). Doing this
  // BEFORE the 12h pass means a gap is patched with one 8h person rather than a
  // LONE m12_day (07–19) that would leave 19:00→night thin with no m12_night
  // partner. Records the overrides so the manager can be alerted.
  st.overriddenOff = runCoverageRescue(input, st, metas)
  // LAST RESORT: 12h auto-coverage for any slot the 8h fill + rescue still can't
  // staff (a genuine shortage). day/night pair preferred, 03-15/15-03 last.
  st.twelve = skipTwelve ? [] : runTwelveFill(input, st)
  return st
}

/** Total filled slots in a committed FillState (sum of committed assignments). */
export function countFilled(st: FillState): number {
  let n = 0
  for (const id of Object.keys(st.committed)) n += st.committed[id].length
  return n
}
