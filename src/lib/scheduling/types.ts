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
  employmentType: EmploymentType
  minShifts: number
  maxShifts: number | null
  observesShabbat: boolean
  observesHolidays: boolean
  mustAccept: boolean
  availability: Record<number, ShiftKey[]> | null
}

/** Per-day metadata. Friday = index 5, Saturday = index 6 (implicit by index). */
export interface DayMeta {
  index: number // 0..6
  isHolidayEve: boolean
  isHoliday: boolean
}

/** Per employee per day request (caller has merged vacations + off-requests into `off`). */
export interface DayRequest {
  off: boolean
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
}
