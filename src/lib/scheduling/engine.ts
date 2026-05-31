// Orchestrator: pure generateSchedule + validateAssignment. Deterministic.
import type {
  Assignment,
  DayMeta,
  Employee,
  EngineInput,
  EngineResult,
  Grid,
  ShiftKey,
} from './types'
import { isAssignable, type CheckContext } from './constraints'
import { compareCandidates, type CandidateState } from './scoring'
import { mulberry32, shuffle } from './lottery'
import { checkFeasibility } from './feasibility'
import { buildTwelveHourSuggestions } from './fallback'
import {
  collectWarnings,
  computeCoverage,
  computeStats,
  emptyGrid,
  forEachRequirement,
} from './grid'

interface State {
  grid: Grid
  committed: Record<string, Assignment[]>
  satisfied: Record<string, number>
  lotteryRank: Record<string, number>
}

/** Deterministic per-employee lottery ranks from the seed. */
function buildLotteryRanks(input: EngineInput): Record<string, number> {
  const rng = mulberry32(input.seed)
  const order = shuffle(
    input.employees.map((e) => e.id),
    rng,
  )
  const ranks: Record<string, number> = {}
  order.forEach((id, i) => (ranks[id] = i))
  return ranks
}

function reqOf(input: EngineInput, empId: string, day: number) {
  return input.requests[empId]?.[day] ?? { off: false, preferred: [] }
}

function ctxFor(
  input: EngineInput,
  emp: Employee,
  meta: DayMeta,
  shift: ShiftKey,
  roleId: string,
  st: State,
): CheckContext {
  return {
    emp,
    meta,
    shift,
    roleId,
    request: reqOf(input, emp.id, meta.index),
    current: st.committed[emp.id],
    settings: input.settings,
  }
}

function pickWinner(
  input: EngineInput,
  meta: DayMeta,
  shift: ShiftKey,
  roleId: string,
  st: State,
  requireRequested: boolean,
): Employee | null {
  const candidates: { emp: Employee; cs: CandidateState }[] = []
  for (const emp of input.employees) {
    const req = reqOf(input, emp.id, meta.index)
    const requested = req.preferred.includes(shift)
    if (requireRequested && !requested) continue
    if (!isAssignable(ctxFor(input, emp, meta, shift, roleId, st))) continue
    candidates.push({
      emp,
      cs: {
        emp,
        requested,
        mustAcceptRequested: emp.mustAccept && requested,
        current: st.committed[emp.id],
        requestsSatisfied: st.satisfied[emp.id],
        lotteryRank: st.lotteryRank[emp.id],
      },
    })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => compareCandidates(a.cs, b.cs))
  return candidates[0].emp
}

function assign(
  st: State,
  emp: Employee,
  meta: DayMeta,
  shift: ShiftKey,
  roleId: string,
  requested: boolean,
): void {
  st.grid[meta.index][shift][roleId].push(emp.id)
  st.committed[emp.id].push({ employeeId: emp.id, day: meta.index, shift, roleId })
  if (requested) st.satisfied[emp.id]++
}

function fill(input: EngineInput, st: State): void {
  const metaByIndex: Record<number, DayMeta> = {}
  for (const m of input.days) metaByIndex[m.index] = m
  for (const requireRequested of [true, false]) {
    forEachRequirement(input, (day, shift, roleId, need) => {
      const meta = metaByIndex[day]
      while (st.grid[day][shift][roleId].length < need) {
        const winner = pickWinner(input, meta, shift, roleId, st, requireRequested)
        if (!winner) break
        const requested = reqOf(input, winner.id, day).preferred.includes(shift)
        assign(st, winner, meta, shift, roleId, requested)
      }
    })
  }
}

export function generateSchedule(input: EngineInput): EngineResult {
  const st: State = {
    grid: emptyGrid(input),
    committed: {},
    satisfied: {},
    lotteryRank: buildLotteryRanks(input),
  }
  for (const e of input.employees) {
    st.committed[e.id] = []
    st.satisfied[e.id] = 0
  }

  fill(input, st)

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
    twelveHourSuggestions: buildTwelveHourSuggestions(warnings, input.settings),
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
