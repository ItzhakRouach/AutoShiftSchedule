import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ShiftId } from '@/lib/domain/constants'
import { expandRolesByRank } from './role-rank'
import { weekDatesFrom } from './map-rows'
import { isInVacationRange } from '@/lib/dates/week'

/** Client-side data needed to drive the SwapEditor (candidate statuses + 12h). */
export interface EmployeeEditMeta {
  id: string
  /** role UUIDs this employee holds. */
  roleIds: string[]
  /** day → allowed base shift keys; null = unrestricted. */
  availability: Record<number, ShiftId[]> | null
  /** day → off (vacation already merged server-side is NOT here; requests only). */
  offDays: number[]
  /** day → preferred base shift keys (for the "✓ ביקש" badge). */
  preferred: Record<number, ShiftId[]>
  maxShifts: number | null
  observesShabbat: boolean
  /** day → committed shiftKey (base or 12h) for one-per-day/rest checks. */
  committed: Record<number, ShiftId>
  /** Day indices (0–6) this week the worker is on an APPROVED absence
   *  (vacation / מילואים / מחלה) → a hard block in the candidate list. */
  absentDays: number[]
}

export interface EditMeta {
  minRestHours: number
  /** key → shift_type_id for all shift types (base + 12h variants). */
  keyToShiftTypeId: Record<string, string>
  employees: Record<string, EmployeeEditMeta>
}

/** Loads lightweight per-employee data so the client can label candidates. */
export async function getEditMeta(
  supabase: SupabaseClient,
  workplaceId: string,
  periodId: string,
  weekStart: string,
): Promise<EditMeta | null> {
  const { data: emps } = await supabase
    .from('employees')
    .select('id, max_shifts_per_week, observes_shabbat')
    .eq('workplace_id', workplaceId)
  if (!emps) return null
  const ids = emps.map((e) => e.id)

  const [{ data: shiftTypes }, { data: settings }, { data: roles }, { data: workplaceRoles }, { data: avail }, { data: reqs }, { data: assigns }, { data: vacs }] =
    await Promise.all([
      supabase.from('shift_types').select('id, key').eq('workplace_id', workplaceId),
      supabase.from('workplace_settings').select('min_rest_hours').eq('workplace_id', workplaceId).maybeSingle(),
      ids.length ? supabase.from('employee_roles').select('employee_id, role_id').in('employee_id', ids) : Promise.resolve({ data: [] }),
      // Workplace roles WITH rank → expand each employee's held roles so a senior
      // (e.g. אחמ״ש) qualifies for every lower-ranked role, matching the engine.
      supabase.from('roles').select('id, rank').eq('workplace_id', workplaceId),
      ids.length ? supabase.from('employee_availability').select('employee_id, day_of_week, shift_type_id').in('employee_id', ids) : Promise.resolve({ data: [] }),
      supabase.from('requests').select('employee_id, day_of_week, is_off, preferred_shift_ids').eq('period_id', periodId),
      supabase.from('assignments').select('employee_id, day_of_week, shift_type_id').eq('period_id', periodId),
      // APPROVED absences (vacation/מילואים/מחלה) → a hard block on their days.
      ids.length ? supabase.from('employee_vacations').select('employee_id, date_from, date_to').in('employee_id', ids).eq('status', 'approved') : Promise.resolve({ data: [] }),
    ])

  const idToKey: Record<string, ShiftId> = {}
  const keyToShiftTypeId: Record<string, string> = {}
  for (const st of shiftTypes ?? []) {
    idToKey[st.id as string] = st.key as ShiftId
    keyToShiftTypeId[st.key as string] = st.id as string
  }

  const employees: Record<string, EmployeeEditMeta> = {}
  for (const e of emps) {
    employees[e.id] = {
      id: e.id,
      roleIds: [],
      availability: null,
      offDays: [],
      preferred: {},
      maxShifts: e.max_shifts_per_week ?? null,
      observesShabbat: e.observes_shabbat ?? false,
      committed: {},
      absentDays: [],
    }
  }
  for (const r of roles ?? []) employees[r.employee_id]?.roleIds.push(r.role_id)
  // Expand held roles by rank (senior auto-qualifies for lower roles) so the
  // candidate list lets the manager place e.g. an אחמ״ש into a מאבטח slot.
  const rolesWithRank = (workplaceRoles ?? []).map((r) => ({ id: r.id as string, rank: r.rank as number | null }))
  for (const e of emps) {
    const m = employees[e.id]
    if (m) m.roleIds = expandRolesByRank(m.roleIds, rolesWithRank)
  }
  for (const a of avail ?? []) {
    const m = employees[a.employee_id]
    const key = idToKey[a.shift_type_id]
    if (!m || !key) continue
    const map = (m.availability ??= {})
    ;(map[a.day_of_week] ??= []).push(key)
  }
  for (const r of reqs ?? []) {
    const m = employees[r.employee_id]
    if (!m) continue
    if (r.is_off) m.offDays.push(r.day_of_week)
    const pref = (r.preferred_shift_ids ?? [])
      .map((id: string) => idToKey[id])
      .filter((k: ShiftId | undefined): k is ShiftId => Boolean(k))
    if (pref.length) m.preferred[r.day_of_week] = pref
  }
  for (const a of assigns ?? []) {
    const m = employees[a.employee_id]
    const key = idToKey[a.shift_type_id]
    if (m && key) m.committed[a.day_of_week] = key
  }
  // Map each employee's approved absence ranges onto this week's day indices.
  const weekDates = weekDatesFrom(weekStart)
  const rangesByEmp: Record<string, { date_from: string; date_to: string }[]> = {}
  for (const v of vacs ?? []) {
    ;(rangesByEmp[v.employee_id as string] ??= []).push({ date_from: v.date_from as string, date_to: v.date_to as string })
  }
  for (const [empId, ranges] of Object.entries(rangesByEmp)) {
    const m = employees[empId]
    if (!m) continue
    for (let d = 0; d < 7; d++) if (isInVacationRange(weekDates[d], ranges)) m.absentDays.push(d)
  }

  return { minRestHours: settings?.min_rest_hours ?? 8, keyToShiftTypeId, employees }
}
