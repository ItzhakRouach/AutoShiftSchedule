// Pure typed inputs/outputs for the scheduling engine — NO Supabase/IO imports.

export type ShiftKey = 'morning' | 'noon' | 'night'

/** The three base 8h shifts, in order (typed as ShiftKey, unlike SHIFT_ORDER). */
export const BASE_SHIFTS: ShiftKey[] = ['morning', 'noon', 'night']
export type TwelveHourKey = 'm12_day' | 'm12_night' | 'm12_3to15' | 'm12_15to3'
export type EmploymentType = 'full' | 'part' | 'student'

/** A guard. `availability` is keyed by dayOfWeek (0–6) → allowed base-shift keys; null = unrestricted. */
export interface Employee {
  id: string
  roleIds: string[]
  /**
   * Subset of `roleIds` for which this employee is a SENIOR (priority) holder.
   * Within a role, senior holders are favored for that role's shifts over regular
   * holders (soft objective only — see scoring.compareCandidates and the role
   * balance term in diversity.ts). Empty/undefined ⇒ regular for every role, so
   * the role splits evenly across all holders. Never overrides hard constraints.
   */
  seniorRoleIds?: string[]
  employmentType: EmploymentType
  minShifts: number
  maxShifts: number | null
  observesShabbat: boolean
  observesHolidays: boolean
  mustAccept: boolean
  availability: Record<number, ShiftKey[]> | null
  /**
   * Cross-week fairness carry-over: how many shifts SHORT of their minimum this
   * employee was in the most-recent PUBLISHED prior period (max(0, minShifts −
   * shiftsThen)). 0 (default) when there is no prior published period. A higher
   * value boosts reach-minimum priority THIS week (soft objective only — see
   * scoring.reachMinRank). Never overrides hard constraints or coverage.
   */
  priorDeficit?: number
  /**
   * Cross-week extras carry-over: how many shifts ABOVE this employee's minimum
   * they worked in the most-recent PUBLISHED prior period (max(0, shiftsThen −
   * minShifts)). 0 (default) when there is no prior published period. Used as a
   * SOFT signal in `fairnessScore` to spread "extra" shifts across full-timers
   * across weeks (the person who already worked 6 last week with min 5 should
   * be picked LESS often for extras this week). Never overrides hard
   * constraints, never reduces coverage, never overrides `must_accept`.
   */
  priorExtras?: number
}

/** Per-day metadata. Friday = index 5, Saturday = index 6 (implicit by index). */
export interface DayMeta {
  index: number // 0..6
  isHolidayEve: boolean
  isHoliday: boolean
}

/** Per employee per day request. `off` is the union of any off-state (the normal
 *  fill blocks it). `offHard` marks a NON-overridable off — a vacation or a
 *  manager-set רענון — which the coverage-rescue pass must never reclaim. A
 *  plain worker off-REQUEST is `off:true, offHard:false` (soft: overridable to
 *  rescue an otherwise-uncoverable day). */
export interface DayRequest {
  off: boolean
  offHard?: boolean
  preferred: ShiftKey[]
}

/** requests[employeeId][dayIndex] */
export type RequestMap = Record<string, Record<number, DayRequest>>

/** requirements[dayIndex][shiftKey][roleId] = count */
export type Requirements = Record<number, Record<ShiftKey, Record<string, number>>>

export interface Settings {
  minRestHours: number // default 8
  idealRestHours: number // default 16
  allow12hFallback: boolean
}

export interface EngineInput {
  employees: Employee[]
  days: DayMeta[]
  requests: RequestMap
  requirements: Requirements
  settings: Settings
  seed: number
  /**
   * Cross-week rest carry-over: per-employee list of END abs-hours of shifts
   * worked in the immediately-preceding published period. Reference: current
   * week day 0 starts at abs hour 0, so a prior Saturday night (23–07) ends at
   * abs hour 7 — exactly 0h before Sunday morning (also abs 7) and so blocks
   * Sunday morning when minRestHours ≥ 1. {} = no prior tail (no published
   * adjacent week). Used ONLY by `restSatisfied` (does NOT inflate maxShifts).
   */
  priorWeekTail?: Record<string, number[]>
  /**
   * Cross-week rest carry-over, symmetric to `priorWeekTail` but FORWARD:
   * per-employee START abs-hours of shifts already committed next week (any
   * status). E.g. a next-week Sunday morning starts at abs 175 — 0h after a
   * current-week Saturday night (ends at abs 175) — blocking that Saturday
   * night when minRestHours ≥ 1. {} = no adjacent next week.
   */
  nextWeekHead?: Record<string, number[]>
}

/** A concrete assignment of an employee to a day/shift/role. */
export interface Assignment {
  employeeId: string
  day: number
  shift: ShiftKey
  roleId: string
  /** true when this base-shift cell is occupied by a 12h shift (auto-coverage). */
  is12h?: boolean
  /** the 12h variant key when is12h; identifies the canonical 12h record. */
  variant?: TwelveHourKey
}

/**
 * Canonical 12h-coverage record (one per person/day/variant). The grid still
 * shows the person in each covered base-shift cell (flagged is12h); this is the
 * single record used for persistence.
 */
export interface TwelveHourAssignment {
  employeeId: string
  day: number
  variant: TwelveHourKey
  /** role the employee fills in EACH covered base shift (may differ per shift). */
  rolesByShift: Partial<Record<ShiftKey, string>>
}

/** grid[day][shift][roleId] = employeeId[] */
export type Grid = Record<number, Record<ShiftKey, Record<string, string[]>>>

export interface Warning {
  day: number
  shift: ShiftKey
  roleId: string
  missing: number
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
}

/** A soft off-request reclaimed by coverage-rescue (see coverage-rescue.ts). */
export interface OverriddenOff {
  employeeId: string
  day: number
  shift: ShiftKey
  roleId: string
}
