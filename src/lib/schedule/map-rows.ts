// PURE mapping: plain DB rows → engine EngineInput. NO Supabase/IO imports.
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
import { buildHolidayMeta } from '@/lib/holidays/day-meta'
import { expandRolesByRank } from './role-rank'
// Row shapes + MapInput live in map-rows-types.ts (kept this file under the
// 200-line budget); re-exported below so existing `from './map-rows'` imports
// are unaffected.
import type { MapInput, RequestRow, VacationRow } from './map-rows-types'

export type * from './map-rows-types'

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

  // Engine keys roles by NAME; map UUID→name (input) and name→UUID (persist output).
  const roleIdToName: Record<string, string> = {}
  const nameToRoleId: Record<string, string> = {}
  for (const r of rows.roles) {
    roleIdToName[r.id] = r.name
    nameToRoleId[r.name] = r.id
  }

  // Group held role IDs per employee, EXPAND by rank (higher role auto-qualifies
  // for all lower) → names. Applies the hierarchy to auto-scheduling AND manual edits.
  const heldIdsByEmp: Record<string, string[]> = {}
  for (const r of rows.employeeRoles) {
    if (roleIdToName[r.role_id]) (heldIdsByEmp[r.employee_id] ??= []).push(r.role_id)
  }
  const rolesByEmp: Record<string, string[]> = {}
  for (const [empId, heldIds] of Object.entries(heldIdsByEmp)) {
    rolesByEmp[empId] = expandRolesByRank(heldIds, rows.roles).map((id) => roleIdToName[id]).filter(Boolean)
  }

  // Senior role NAMES per employee (the engine keys roles by name). Seniority is
  // per the specific role marked — not rank-expanded — so it only biases that
  // exact role's distribution.
  const seniorRolesByEmp: Record<string, string[]> = {}
  for (const r of rows.employeeRoles) {
    if (r.is_senior && roleIdToName[r.role_id]) {
      ;(seniorRolesByEmp[r.employee_id] ??= []).push(roleIdToName[r.role_id])
    }
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
    seniorRoleIds: seniorRolesByEmp[e.id] ?? [],
    employmentType: normEmploymentType(e.employment_type),
    minShifts: e.min_shifts_per_week ?? 0,
    maxShifts: e.max_shifts_per_week ?? null,
    observesShabbat: e.observes_shabbat ?? false,
    // Safety-net: Shabbat observance implies holiday observance (handles legacy rows).
    observesHolidays: (e.observes_holidays ?? false) || (e.observes_shabbat ?? false),
    mustAccept: e.must_accept ?? false,
    availability: availByEmp[e.id] ?? null,
    priorDeficit: rows.priorDeficit?.[e.id] ?? 0,
    priorExtras: rows.priorExtras?.[e.id] ?? 0,
  }))

  // רענון (day notes): employee_id → set of reserved day indices (hard off).
  const refresherByEmp: Record<string, Set<number>> = {}
  for (const n of rows.dayNotes ?? []) {
    ;(refresherByEmp[n.employee_id] ??= new Set()).add(n.day_of_week)
  }

  const requests: RequestMap = {}
  for (const e of rows.employees) {
    const perDay: Record<number, { off: boolean; offHard: boolean; preferred: ShiftKey[] }> = {}
    for (let d = 0; d < 7; d++) {
      const row = reqByEmp[e.id]?.[d]
      const preferred = (row?.preferred_shift_ids ?? [])
        .map((id) => idToKey[id])
        .filter((k): k is ShiftKey => Boolean(k))
      // Soft off = a plain worker off-request (overridable to rescue coverage).
      const offSoft = row?.is_off ?? false
      // Hard off (never overridden by coverage-rescue): vacation, רענון, OR a
      // MUST-ACCEPT worker's off-request — their requests are honored absolutely,
      // so an off-day they asked for is guaranteed no matter the coverage cost.
      const date = rows.weekDates[d]
      const onVacation = !!date && (vacByEmp[e.id] ?? []).some((v) => dateInRange(date, v.date_from, v.date_to))
      const onRefresher = refresherByEmp[e.id]?.has(d) ?? false
      const offHard = onVacation || onRefresher || (offSoft && (e.must_accept ?? false))
      perDay[d] = { off: offHard || offSoft, offHard, preferred }
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

  const holidayMeta = buildHolidayMeta(rows.weekDates, rows.holidayDates ?? new Set())
  const days: DayMeta[] = Array.from({ length: 7 }, (_, index) => ({
    index,
    isHolidayEve: holidayMeta[index].isHolidayEve,
    isHoliday: holidayMeta[index].isHoliday,
  }))

  const settings: Settings = {
    minRestHours: rows.settings?.min_rest_hours ?? 8,
    idealRestHours: rows.settings?.ideal_rest_hours ?? 16,
    allow12hFallback: rows.settings?.allow_12h_fallback ?? true,
  }

  return {
    input: {
      employees, days, requests, requirements, settings, seed: rows.seed,
      priorWeekTail: rows.priorWeekTail,
      nextWeekHead: rows.nextWeekHead,
    },
    keyToShiftTypeId,
    nameToRoleId,
  }
}

export { seedFromUuid, weekDatesFrom } from './seed'
