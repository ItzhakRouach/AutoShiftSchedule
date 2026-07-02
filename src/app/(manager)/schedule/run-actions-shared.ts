import 'server-only'
import type { Coverage, FeasibilityResult, TwelveHourSuggestion, OverriddenOff, Warning } from '@/lib/scheduling/types'

// Shared types/constants for actions.ts (runSchedule) + lifecycle-actions.ts
// (publish/unpublish/clear). Split out because a 'use server' module may only
// export async functions — see edit-actions-helpers.ts for the same pattern.

export interface RunResult {
  ok: boolean
  error?: string
  coverage?: Coverage
  feasibility?: FeasibilityResult
  warnings?: number
  twelveHourSuggestions?: TwelveHourSuggestion[]
  /** Soft off-requests the engine overrode to staff a day (employeeId, day,
   *  shift, roleId=role NAME) — surfaced so the manager can talk to them. */
  overriddenOff?: OverriddenOff[]
  /** Slots still uncovered after rescue + 12h (day, shift, roleId=name, missing). */
  uncovered?: Warning[]
}

export interface RunOptions {
  /** When false (default), manual/fallback_12h rows are preserved and auto rows
   *  are regenerated around them. When true, ALL rows are wiped first. */
  replaceManual?: boolean
  /** When true, the engine also runs the 12h auto-coverage pass (the secondary
   *  "השלם 12ש׳ אוטומטית" action). Default false — the primary generate button
   *  fills only regular 8h shifts (see EngineInput.skipTwelve). */
  withTwelveHour?: boolean
}

export const GENERIC_ERROR = 'אירעה שגיאה בעת יצירת הסידור. נסו שוב.'
export const MANUAL_SOURCES = ['manual', 'fallback_12h'] as const
