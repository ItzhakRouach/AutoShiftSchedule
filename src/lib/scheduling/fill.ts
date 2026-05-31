// Shared fill routine (FIX B): the SINGLE source of truth for how slots get
// staffed. Both generateSchedule and checkFeasibility run THIS, so feasibility
// can never disagree with the grid. Pure & deterministic.
import type { DayMeta, Employee, EngineInput } from './types'
import type { MatchSlot } from './matching'
import { lotteryRank } from './lottery'
import { emptyGrid } from './grid'
import { matchDay, isTopPrecedenceFor, type FillState } from './dayfill'

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
 * Reservation pre-pass (FIX 5): per-day matching rounds restricted to each
 * employee's REQUESTED slots, capped at a weekly budget. A requested slot is
 * reserved only if the employee is the top-precedence candidate for it, so the
 * canonical FIX-A ordering still governs contended slots.
 */
function reservationRound(
  input: EngineInput,
  st: FillState,
  metas: Record<number, DayMeta>,
  budget: number,
  onlyIfZero: boolean,
): void {
  for (const d of input.days) {
    const meta = metas[d.index]
    matchDay(
      input,
      meta,
      st,
      (e) => {
        const have = st.satisfied[e.id]
        if (onlyIfZero && have > 0) return 0
        return have < budget ? 1 : 0
      },
      (e, slot) =>
        requestsSlot(input, e, slot) && isTopPrecedenceFor(input, meta, st, e, slot),
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
 */
export function runFill(input: EngineInput): FillState {
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
  // FIX 5: reserve up to 2 requested slots each, then ensure >=1 for anyone at 0.
  reservationRound(input, st, metas, 2, false)
  reservationRound(input, st, metas, 1, true)
  // FIX 2: general max-matching fill of all remaining required slots.
  generalFill(input, st, metas)
  return st
}

/** Total filled slots in a committed FillState (sum of committed assignments). */
export function countFilled(st: FillState): number {
  let n = 0
  for (const id of Object.keys(st.committed)) n += st.committed[id].length
  return n
}
