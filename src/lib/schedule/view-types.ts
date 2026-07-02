// Shared types + pure helpers for the schedule "view" shape consumed by the
// manager and employee schedule pages. Split out of view-data.ts to honor the
// project's ≤200-line rule (see CLAUDE.md).
import type { FeasibilityResult, ShiftKey } from '@/lib/scheduling/types'
import type { ShiftDisplay } from '@/lib/domain/meta'
import type { NightBeforeMap } from './night-before'
import type { AbsenceKind } from '@/lib/vacations/kind-meta'
import type { TwelveFillEntry } from './twelve-fills'

export interface ViewEmployee { id: string; name: string; color: string }
export interface ViewRole { id: string; name: string; color?: string; rank?: number }
export interface DayInfo { index: number; short: string; date: string }
/** assignments[day][shiftKey][roleId] = employeeId[] */
export type ViewGrid = Record<number, Record<string, Record<string, string[]>>>
/** requirements[day][shiftKey][roleId] = count */
export type ViewReq = Record<number, Record<string, Record<string, number>>>

/** A single fill window of a 12h assignment, camelCase for view consumers. */
export interface ViewTwelveFill {
  shift: ShiftKey
  roleId: string
}

/** A persisted 12h assignment, surfaced separately so it renders distinctly. */
export interface ViewTwelve {
  day: number
  variant: string // ShiftId (12h key)
  roleId: string
  employeeId: string
  /**
   * The real persisted fill plan (Task 1's `twelve_fills` column), in
   * TWELVE_HOUR_FILLS order, each under its OWN role — cross-role plans are
   * legal. `undefined` for legacy rows (column null/malformed): the view
   * falls back to the pre-existing heuristic (see week-table-twelve.ts).
   */
  fills?: ViewTwelveFill[]
}

/** An ad-hoc free-text "temp" worker placed in a cell (no roster employee). */
export interface ViewTempEntry {
  day: number
  shiftKey: string // base ShiftKey the temp fills
  roleId: string
  assignmentId: string
  name: string
}

/** One employee's request for a single day. */
export interface ViewRequest {
  employeeId: string
  dayOfWeek: number
  isOff: boolean
  preferredShiftIds: string[]
}

/** A manager-assigned day note (רענון / free text) marking an employee off-shift. */
export interface DayNote {
  employeeId: string
  day: number
  label: string
}

/** One vacation row surfaced to the manager view — inclusive date range. */
export interface ViewVacation {
  employeeId: string
  dateFrom: string
  dateTo: string
  kind: AbsenceKind
}

export interface ScheduleView {
  periodId: string
  status: string
  weekStart: string
  days: DayInfo[]
  shiftKeys: ShiftKey[]
  roles: ViewRole[]
  employees: ViewEmployee[]
  requirements: ViewReq
  grid: ViewGrid
  twelve: ViewTwelve[]
  /** Ad-hoc free-text temp workers placed in cells (no roster employee). */
  temps: ViewTempEntry[]
  /** base shiftKey → shift_type_id (for opening the editor on a base slot). */
  shiftTypeIdByKey: Record<string, string>
  /** base shiftKey → display meta (name/time/color) from the workplace's DB rows. */
  shiftMeta?: Record<string, ShiftDisplay>
  hasAssignments: boolean
  feasibility: FeasibilityResult | null
  /** All employee requests for this period. */
  requests: ViewRequest[]
  /**
   * Set of "employeeId:day:shiftTypeId" keys where the assignment matches a
   * requested shift (is_off=false AND preferred_shift_ids includes the assigned
   * base shift's type id).
   */
  requestedSet: Set<string>
  /** Manager-assigned day notes (רענון / free text) for this period. */
  dayNotes?: DayNote[]
  /** Employee-submitted vacation ranges visible to the manager (RLS-scoped). */
  vacations?: ViewVacation[]
  /** Time-limited signed URL to the period's published schedule PNG. Present
   *  only when status === 'published' AND an image was uploaded. 7-day TTL. */
  imageShareUrl?: string | null
  /**
   * Per day D (0..6), the list of employee IDs whose previous shift extended
   * past midnight of D — i.e. they were physically working overnight when D
   * begins. Used by the day-note UI to warn the manager when labeling someone
   * the day after a night/m12_night/m12_15to3 shift. D=0 (Sunday) consults the
   * prior-week tail to catch Saturday-night → Sunday cases. Optional for
   * legacy callers (published-view, tests) that don't populate it.
   */
  nightBeforeByDay?: NightBeforeMap
}

/**
 * Pure helper — builds a Set of "employeeId:day:shiftTypeId" keys where the
 * employee actively requested that exact shift (is_off=false and the shift id
 * appears in preferred_shift_ids). Exported for unit testing.
 */
export function buildRequestedSet(requests: ViewRequest[]): Set<string> {
  const set = new Set<string>()
  for (const r of requests) {
    if (r.isOff || r.preferredShiftIds.length === 0) continue
    for (const sid of r.preferredShiftIds) {
      set.add(`${r.employeeId}:${r.dayOfWeek}:${sid}`)
    }
  }
  return set
}

// Re-export so consumers of view-types.ts can reach TwelveFillEntry without a
// second import path (used internally by view-data-grid.ts).
export type { TwelveFillEntry }
