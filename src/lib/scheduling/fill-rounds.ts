// Pre-general-fill reservation rounds used by fill.ts's runFill (split out to
// keep fill.ts under the file-size budget). Pure & deterministic — see fill.ts
// header for the overall fill-pipeline contract.
import type { DayMeta, Employee, EngineInput } from './types'
import type { MatchSlot } from './matching'
import { lotteryRank } from './lottery'
import { matchDay, isTopPrecedenceFor, type FillState } from './dayfill'

export function reqOf(input: EngineInput, empId: string, day: number) {
  return input.requests[empId]?.[day] ?? { off: false, preferred: [] }
}

export function metaMap(input: EngineInput): Record<number, DayMeta> {
  const m: Record<number, DayMeta> = {}
  for (const d of input.days) m[d.index] = d
  return m
}

/** A slot is "requested" by emp if it's in their preferred list that day. */
function requestsSlot(input: EngineInput, e: Employee, slot: MatchSlot): boolean {
  return reqOf(input, e.id, slot.day).preferred.includes(slot.shift)
}

/** Deterministic per-employee lottery ranks: pure fn of (seed, id) (FIX 1). */
export function buildLotteryRanks(input: EngineInput): Record<string, number> {
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
export function honorRequestsRound(
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
export function mustAcceptRound(
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
export function carryOverRound(
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

export function generalFill(input: EngineInput, st: FillState, metas: Record<number, DayMeta>): void {
  for (const d of input.days) {
    matchDay(input, metas[d.index], st, () => 1, () => true)
  }
}
