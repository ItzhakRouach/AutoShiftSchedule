// Row shapes (mirror the DB columns we read) + MapInput, split out of
// map-rows.ts to keep that file under the 200-line budget. Re-exported from
// map-rows.ts so existing `from './map-rows'` imports are unaffected.

export interface ShiftTypeRow { id: string; key: string }
export interface EmployeeRow {
  id: string
  employment_type: string | null
  min_shifts_per_week: number | null
  max_shifts_per_week: number | null
  observes_shabbat: boolean | null
  observes_holidays: boolean | null
  must_accept: boolean | null
}
export interface EmployeeRoleRow { employee_id: string; role_id: string; is_senior?: boolean }
export interface AvailabilityRow { employee_id: string; day_of_week: number; shift_type_id: string }
export interface RequestRow {
  employee_id: string
  day_of_week: number
  is_off: boolean | null
  preferred_shift_ids: string[] | null
}
export interface VacationRow { employee_id: string; date_from: string; date_to: string }
/** A manager-set day note (רענון / השתלמות): the employee is reserved that day. */
export interface DayNoteRow { employee_id: string; day_of_week: number }
export interface RequirementRow {
  day_of_week: number
  shift_type_id: string
  role_id: string
  count: number
}
export interface SettingsRow {
  min_rest_hours: number | null
  ideal_rest_hours: number | null
  allow_12h_fallback: boolean | null
}

export interface RoleRow { id: string; name: string; rank?: number | null }

export interface MapInput {
  weekDates: string[] // 7 ISO dates (YYYY-MM-DD), index 0..6
  shiftTypes: ShiftTypeRow[] // base, is_fallback=false
  roles: RoleRow[]
  employees: EmployeeRow[]
  employeeRoles: EmployeeRoleRow[]
  availability: AvailabilityRow[]
  requests: RequestRow[]
  vacations: VacationRow[]
  /** Manager-set day notes (רענון) — reserve the employee that day (hard off). */
  dayNotes?: DayNoteRow[]
  requirements: RequirementRow[]
  settings: SettingsRow | null
  seed: number
  /** Set of holiday dates (YYYY-MM-DD) covering the week + the day after (for eve detection). */
  holidayDates?: Set<string>
  /** Cross-week fairness: employee_id → shortfall in most-recent published period. */
  priorDeficit?: Record<string, number>
  /** Cross-week extras fairness: employee_id → surplus shifts in most-recent published period. */
  priorExtras?: Record<string, number>
  /** Cross-week rest: employee_id → END abs hours of prior-week shifts
   *  (current week day 0 = abs hour 0). See EngineInput.priorWeekTail. */
  priorWeekTail?: Record<string, number[]>
  /** Cross-week rest, symmetric to priorWeekTail: employee_id → START abs
   *  hours of next-week shifts. See EngineInput.nextWeekHead. */
  nextWeekHead?: Record<string, number[]>
}
