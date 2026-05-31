// Orchestrator: pure generateSchedule + validateAssignment. Deterministic.
import type {
  Assignment,
  DayMeta,
  Employee,
  EngineInput,
  EngineResult,
  ShiftKey,
} from './types'
import { isAssignable } from './constraints'
import { lotteryRank } from './lottery'
import { checkFeasibility } from './feasibility'
import { buildTwelveHourSuggestions } from './fallback'
import { collectWarnings, computeCoverage, computeStats, emptyGrid } from './grid'
import { matchDay, isTopPrecedenceFor, type FillState } from './dayfill'
import type { MatchSlot } from './matching'

/** Deterministic per-employee lottery ranks: pure fn of (seed, id) (FIX 1). */
function buildLotteryRanks(input: EngineInput): Record<string, number> {
  const ranks: Record<string, number> = {}
  for (const e of input.employees) ranks[e.id] = lotteryRank(input.seed, e.id)
  return ranks
}

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

/**
 * Reservation pre-pass (FIX 5): before general fill, run per-day matching rounds
 * restricted to each employee's REQUESTED slots, capping each employee at a total
 * weekly reservation budget. `targetEach` rounds give every employee up to that
 * many requested slots; `onlyIfZero` restricts the round to employees who still
 * have no satisfied request (used to guarantee >=1 where >=2 is infeasible).
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
      // Reserve a REQUESTED slot only if the employee is the top-precedence
      // candidate for it (so full-time-first still wins contended slots, FIX 4).
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

export function generateSchedule(input: EngineInput): EngineResult {
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

  const warnings = collectWarnings(input, st.grid)
  const feasibility = checkFeasibility(input)
  const coverage = computeCoverage(feasibility.requiredSlots, warnings)
  const stats = computeStats(input.employees, st.committed, st.satisfied)

  return {
    grid: st.grid,
    assignmentsByEmployee: st.committed,
    warnings,
    coverage,
    stats,
    feasibility,
    twelveHourSuggestions: buildTwelveHourSuggestions(warnings, input.settings, st.committed),
  }
}

/** Re-validate a single proposed assignment against current committed state. */
export function validateAssignment(
  input: EngineInput,
  emp: Employee,
  meta: DayMeta,
  shift: ShiftKey,
  roleId: string,
  current: Assignment[],
): boolean {
  return isAssignable({
    emp,
    meta,
    shift,
    roleId,
    request: reqOf(input, emp.id, meta.index),
    current,
    settings: input.settings,
  })
}
