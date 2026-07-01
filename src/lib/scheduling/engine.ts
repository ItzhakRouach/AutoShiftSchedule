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
import { feasibilityFromFill } from './feasibility'
import { buildTwelveHourSuggestions } from './fallback'
import { collectWarnings, computeCoverage, computeStats } from './grid'
import { runFill } from './fill'

function reqOf(input: EngineInput, empId: string, day: number) {
  return input.requests[empId]?.[day] ?? { off: false, preferred: [] }
}

export function generateSchedule(input: EngineInput): EngineResult {
  // Run the engine's real fill ONCE. Feasibility is derived from this same
  // result (FIX B), guaranteeing coverage.filledSlots == feasibility.maxStaffable.
  const st = runFill(input)

  const warnings = collectWarnings(input, st.grid)
  const feasibility = feasibilityFromFill(input, st)
  const coverage = computeCoverage(feasibility.requiredSlots, warnings)
  const stats = computeStats(input.employees, st.committed, st.satisfied)

  return {
    grid: st.grid,
    assignmentsByEmployee: st.committed,
    twelveHourAssignments: st.twelve ?? [],
    warnings,
    coverage,
    stats,
    feasibility,
    twelveHourSuggestions: buildTwelveHourSuggestions(warnings, input.settings, st.committed),
    overriddenOff: st.overriddenOff ?? [],
    ...(st.timings ? { timings: st.timings } : {}),
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
    priorTail: input.priorWeekTail?.[emp.id],
    nextHead: input.nextWeekHead?.[emp.id],
  })
}
