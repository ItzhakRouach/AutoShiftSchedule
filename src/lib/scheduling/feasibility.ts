// Feasibility (FIX B): derived from the engine's ACTUAL fill, never a separate
// greedy estimate. maxStaffable == the real filledSlots, so the banner can never
// contradict the grid. Pure over the same inputs.
import { BASE_SHIFTS, type EngineInput, type FeasibilityResult, type ShiftKey } from './types'
import { collectWarnings } from './grid'
import { buildTwelveHourSuggestions } from './fallback'
import { runFill, countFilled } from './fill'
import type { FillState } from './dayfill'

/** Count total required role-slots across the week. */
export function countRequiredSlots(input: EngineInput): number {
  let total = 0
  for (const meta of input.days) {
    const dayReq = (input.requirements[meta.index] ?? {}) as Record<ShiftKey, Record<string, number>>
    for (const shift of BASE_SHIFTS) {
      const roleReq = dayReq[shift]
      if (!roleReq) continue
      for (const roleId of Object.keys(roleReq)) total += roleReq[roleId]
    }
  }
  return total
}

/**
 * Maximum number of required 8h slots the engine actually staffs under hard
 * constraints — i.e. exactly what generateSchedule fills. Runs the shared fill.
 */
export function maxStaffableSlots(input: EngineInput): number {
  return countFilled(runFill(input))
}

/**
 * Derive feasibility from an already-computed fill (avoids double work when
 * generateSchedule calls it). maxStaffable == filledSlots; status is 'ok' iff
 * every required slot is filled, else 'needs12h' when 12h fallback is on AND
 * suggestions exist for the gaps, else 'short'.
 */
export function feasibilityFromFill(input: EngineInput, st: FillState): FeasibilityResult {
  const requiredSlots = countRequiredSlots(input)
  const maxStaffable = countFilled(st)
  const shortBy = Math.max(0, requiredSlots - maxStaffable)
  if (shortBy === 0) {
    return {
      status: 'ok',
      requiredSlots,
      maxStaffable,
      shortBy: 0,
      details: 'All required 8h slots can be staffed.',
    }
  }
  const warnings = collectWarnings(input, st.grid)
  const suggestions = buildTwelveHourSuggestions(warnings, input.settings, st.committed)
  const canUse12h = input.settings.allow12hFallback && suggestions.length > 0
  const status = canUse12h ? 'needs12h' : 'short'
  const details = canUse12h
    ? `Short by ${shortBy} 8h slot(s); 12h fallback shifts needed.`
    : `Short by ${shortBy} 8h slot(s); not enough available employees.`
  return { status, requiredSlots, maxStaffable, shortBy, details }
}

/** Standalone feasibility: runs the engine's real fill internally (FIX B). */
export function checkFeasibility(input: EngineInput): FeasibilityResult {
  return feasibilityFromFill(input, runFill(input))
}
