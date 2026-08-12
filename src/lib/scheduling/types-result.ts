// Engine RESULT-side types (grid, warnings, stats, EngineResult). Split from
// types.ts to honor the ≤200-line rule; types.ts re-exports everything here,
// so consumers keep importing from './types'.
import type { Assignment, ShiftKey, TwelveHourAssignment, TwelveHourKey } from './types'

/** grid[day][shift][roleId] = employeeId[] */
export type Grid = Record<number, Record<ShiftKey, Record<string, string[]>>>

/** Why a required slot couldn't be filled (dominant cause among role-holders). */
export type GapReason =
  | 'no_role'            // nobody holds this role
  | 'off'               // blocked by off-requests (soft ones are askable)
  | 'rest'              // all candidates violate min-rest
  | 'at_max'            // all candidates already at their weekly max
  | 'sacred'            // Shabbat/holiday blocks all observers
  | 'availability'      // outside everyone's recurring availability
  | 'assigned_elsewhere'// all candidates already work that day
  | 'available'         // eligible workers exist — can be assigned directly
  | 'mixed'             // no single dominant cause

/** A worker the manager could place/ask to fill the gap. */
export interface GapAskCandidate {
  employeeId: string
  /** 'available' = assignable now; 'soft_off' = asked off but could waive it. */
  reason: 'available' | 'soft_off'
}

export interface Warning {
  day: number
  shift: ShiftKey
  roleId: string
  missing: number
  /** Diagnosis (added by collectWarnings) — why this slot is empty + who to ask. */
  reason?: GapReason
  askCandidates?: GapAskCandidate[]
}

export interface TwelveHourSuggestion {
  day: number
  variant: TwelveHourKey
  roleId: string
  /** base shifts this 12h variant would cover */
  covers: ShiftKey[]
  reason: string
  /** FIX 6: true if this variant overlaps/under-rests an adjacent committed shift. */
  restConflict: boolean
}

export interface EmployeeStat {
  employeeId: string
  shifts: number
  hours: number
  belowMin: boolean
  requestsSatisfied: number
  assignments: Assignment[]
  /** per-shift-type counts (for fairness transparency / tests). */
  byType: { morning: number; noon: number; night: number }
}

export interface Coverage {
  requiredSlots: number
  filledSlots: number
  percent: number
}

export type FeasibilityStatus = 'ok' | 'short' | 'needs12h'

export interface FeasibilityResult {
  status: FeasibilityStatus
  requiredSlots: number
  maxStaffable: number
  shortBy: number
  details: string
}

export interface EngineResult {
  grid: Grid
  assignmentsByEmployee: Record<string, Assignment[]>
  /** canonical 12h records (one per person/day/variant) for persistence. */
  twelveHourAssignments: TwelveHourAssignment[]
  warnings: Warning[]
  coverage: Coverage
  stats: Record<string, EmployeeStat>
  feasibility: FeasibilityResult
  twelveHourSuggestions: TwelveHourSuggestion[]
  /** Soft off-requests the coverage-rescue pass overrode to staff a day, so the
   *  manager can be told who was pulled in despite requesting off. */
  overriddenOff: OverriddenOff[]
  /** Workers holding more nights than their even-share target (hard constraints
   *  or coverage made a legal rebalance impossible) — surfaced as a warning. */
  nightImbalance: NightImbalance[]
  /** Present only when `EngineInput.collectTimings` is true: wall ms per fill pass (see runFill in fill.ts). */
  timings?: Record<string, number>
}

/** A soft off-request reclaimed by coverage-rescue (see coverage-rescue.ts). */
export interface OverriddenOff {
  employeeId: string
  day: number
  shift: ShiftKey
  roleId: string
}

/** A worker over their even-share night target (see night-targets.ts). */
export interface NightImbalance {
  employeeId: string
  nights: number
  target: number
}
