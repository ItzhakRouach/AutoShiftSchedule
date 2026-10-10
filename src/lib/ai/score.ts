// Score a candidate week so the engine's schedule and the AI's can be compared
// on one scale.
//
// Every term is computed by the ENGINE'S OWN pure functions (coverage, stats,
// nightImbalance, diversityCost, nightCount), so the comparison can never drift
// from what the engine itself optimises for. The ordering in `compareScores`
// mirrors the engine's soft-objective priority: coverage is non-negotiable,
// then requests, then minimums, then fairness, with the engine's diversity cost
// as the final tie-break.
import type { EngineInput, EngineResult } from '@/lib/scheduling/types'
import { diversityCost } from '@/lib/scheduling/diversity-cost'
import { buildNightThresholds, nightEligible } from '@/lib/scheduling/night-targets'
import { nightCount } from '@/lib/scheduling/fairness'

export interface ScheduleScore {
  requiredSlots: number
  filledSlots: number
  coveragePercent: number
  requestsSatisfied: number
  belowMinCount: number
  /** max − min nights across the night-eligible pool. */
  nightSpread: number
  nightImbalanceCount: number
  twelveHourCount: number
  diversityCost: number
}

export function scoreSchedule(input: EngineInput, result: EngineResult): ScheduleScore {
  const stats = Object.values(result.stats)
  const pool = new Set(nightEligible(input))
  const nights = input.employees
    .filter((e) => pool.has(e.id))
    .map((e) => nightCount(result.assignmentsByEmployee[e.id] ?? []))

  return {
    requiredSlots: result.coverage.requiredSlots,
    filledSlots: result.coverage.filledSlots,
    coveragePercent: result.coverage.percent,
    requestsSatisfied: stats.reduce((n, s) => n + s.requestsSatisfied, 0),
    belowMinCount: stats.filter((s) => s.belowMin).length,
    nightSpread: nights.length > 0 ? Math.max(...nights) - Math.min(...nights) : 0,
    nightImbalanceCount: result.nightImbalance.length,
    twelveHourCount: result.twelveHourAssignments.length,
    diversityCost: diversityCost(input.employees, result.assignmentsByEmployee, {
      idealRestHours: input.settings.idealRestHours,
      nightThreshold: buildNightThresholds(input),
      balanceRoles: true,
    }),
  }
}

/** Negative when `a` is the better schedule. Lexicographic, highest stake first. */
export function compareScores(a: ScheduleScore, b: ScheduleScore): number {
  return (
    b.filledSlots - a.filledSlots ||
    b.requestsSatisfied - a.requestsSatisfied ||
    a.belowMinCount - b.belowMinCount ||
    a.nightImbalanceCount - b.nightImbalanceCount ||
    a.nightSpread - b.nightSpread ||
    a.twelveHourCount - b.twelveHourCount ||
    a.diversityCost - b.diversityCost
  )
}
