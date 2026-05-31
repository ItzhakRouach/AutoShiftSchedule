// PURE mapping: plain DB rows → engine EngineInput. NO Supabase/IO imports.
// Unit-tested directly with plain row objects (see map-rows.test.ts).
import { BASE_SHIFTS } from '@/lib/scheduling/types'
import type {
  DayMeta,
  Employee,
  EmploymentType,
  EngineInput,
  Requirements,
  RequestMap,
  Settings,
  ShiftKey,
} from '@/lib/scheduling/types'

// ── Row shapes (mirror the DB columns we read) ─────────────────────────────────
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
export interface EmployeeRoleRow { employee_id: string; role_id: string }
export interface AvailabilityRow { employee_id: string; day_of_week: number; shift_type_id: string }
export interface RequestRow {
  employee_id: string
  day_of_week: number
  is_off: boolean | null
  preferred_shift_ids: string[] | null
}
export interface VacationRow { employee_id: string; date_from: string; date_to: string }
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

export interface RoleRow { id: string; name: string }

export interface MapInput {
  weekDates: string[] // 7 ISO dates (YYYY-MM-DD), index 0..6
  shiftTypes: ShiftTypeRow[] // base, is_fallback=false
  roles: RoleRow[]
  employees: EmployeeRow[]
  employeeRoles: EmployeeRoleRow[]
  availability: AvailabilityRow[]
  requests: RequestRow[]
  vacations: VacationRow[]
  requirements: RequirementRow[]
  settings: SettingsRow | null
  seed: number
}

const VALID_EMP: EmploymentType[] = ['full', 'part', 'student']

function normEmploymentType(raw: string | null): EmploymentType {
  return (VALID_EMP as string[]).includes(raw ?? '') ? (raw as EmploymentType) : 'full'
}

/** Inclusive check: is `date` within [from, to] (all YYYY-MM-DD strings). */
function dateInRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to
}

export interface MapResult {
  input: EngineInput
  /** key → shift_type_id (needed to persist engine output back to DB). */
  keyToShiftTypeId: Record<string, string>
  /** role name → role_id (engine roleIds are role NAMES; map back for persistence). */
  nameToRoleId: Record<string, string>
}

export function mapToEngineInput(rows: MapInput): MapResult {
  const idToKey: Record<string, ShiftKey> = {}
  const keyToShiftTypeId: Record<string, string> = {}
  for (const st of rows.shiftTypes) {
    if ((BASE_SHIFTS as string[]).includes(st.key)) {
      idToKey[st.id] = st.key as ShiftKey
      keyToShiftTypeId[st.key] = st.id
    }
  }

  // The engine keys roles by NAME (emptyGrid uses ROLES constant = role names).
  // Map role UUID → name for input, and name → UUID for persisting output.
  const roleIdToName: Record<string, string> = {}
  const nameToRoleId: Record<string, string> = {}
  for (const r of rows.roles) {
    roleIdToName[r.id] = r.name
    nameToRoleId[r.name] = r.id
  }

  // Group roles (by NAME) by employee
  const rolesByEmp: Record<string, string[]> = {}
  for (const r of rows.employeeRoles) {
    const name = roleIdToName[r.role_id]
    if (!name) continue
    ;(rolesByEmp[r.employee_id] ??= []).push(name)
  }

  // Group availability by employee → day → shift keys
  const availByEmp: Record<string, Record<number, ShiftKey[]>> = {}
  for (const a of rows.availability) {
    const key = idToKey[a.shift_type_id]
    if (!key) continue
    const byDay = (availByEmp[a.employee_id] ??= {})
    ;(byDay[a.day_of_week] ??= []).push(key)
  }

  // Vacations by employee
  const vacByEmp: Record<string, VacationRow[]> = {}
  for (const v of rows.vacations) {
    ;(vacByEmp[v.employee_id] ??= []).push(v)
  }

  // Requests by employee → day
  const reqByEmp: Record<string, Record<number, RequestRow>> = {}
  for (const r of rows.requests) {
    ;(reqByEmp[r.employee_id] ??= {})[r.day_of_week] = r
  }

  const employees: Employee[] = rows.employees.map((e) => ({
    id: e.id,
    roleIds: rolesByEmp[e.id] ?? [],
    employmentType: normEmploymentType(e.employment_type),
    minShifts: e.min_shifts_per_week ?? 0,
    maxShifts: e.max_shifts_per_week ?? null,
    observesShabbat: e.observes_shabbat ?? false,
    observesHolidays: e.observes_holidays ?? false,
    mustAccept: e.must_accept ?? false,
    availability: availByEmp[e.id] ?? null,
  }))

  const requests: RequestMap = {}
  for (const e of rows.employees) {
    const perDay: Record<number, { off: boolean; preferred: ShiftKey[] }> = {}
    for (let d = 0; d < 7; d++) {
      const row = reqByEmp[e.id]?.[d]
      const preferred = (row?.preferred_shift_ids ?? [])
        .map((id) => idToKey[id])
        .filter((k): k is ShiftKey => Boolean(k))
      let off = row?.is_off ?? false
      // Merge vacations: any day whose date falls in a vacation range → off.
      const date = rows.weekDates[d]
      if (!off && date) {
        off = (vacByEmp[e.id] ?? []).some((v) => dateInRange(date, v.date_from, v.date_to))
      }
      perDay[d] = { off, preferred }
    }
    requests[e.id] = perDay
  }

  const requirements: Requirements = {}
  for (const r of rows.requirements) {
    const key = idToKey[r.shift_type_id]
    const roleName = roleIdToName[r.role_id]
    if (!key || !roleName) continue
    const day = (requirements[r.day_of_week] ??= {} as Requirements[number])
    const byRole = (day[key] ??= {})
    byRole[roleName] = (byRole[roleName] ?? 0) + r.count
  }

  const days: DayMeta[] = Array.from({ length: 7 }, (_, index) => ({
    index,
    // TODO: holidays — no holidays table exists yet; Shabbat handled by engine via index 5/6.
    isHolidayEve: false,
    isHoliday: false,
  }))

  const settings: Settings = {
    minRestHours: rows.settings?.min_rest_hours ?? 8,
    idealRestHours: rows.settings?.ideal_rest_hours ?? 16,
    allow12hFallback: rows.settings?.allow_12h_fallback ?? true,
  }

  return {
    input: { employees, days, requests, requirements, settings, seed: rows.seed },
    keyToShiftTypeId,
    nameToRoleId,
  }
}

export { seedFromUuid, weekDatesFrom } from './seed'
