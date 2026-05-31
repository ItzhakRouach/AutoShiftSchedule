import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ShiftId } from '@/lib/domain/constants'

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
): Promise<EditMeta | null> {
  const { data: emps } = await supabase
    .from('employees')
    .select('id, max_shifts_per_week, observes_shabbat')
    .eq('workplace_id', workplaceId)
  if (!emps) return null
  const ids = emps.map((e) => e.id)

  const [{ data: shiftTypes }, { data: settings }, { data: roles }, { data: avail }, { data: reqs }, { data: assigns }] =
    await Promise.all([
      supabase.from('shift_types').select('id, key').eq('workplace_id', workplaceId),
      supabase.from('workplace_settings').select('min_rest_hours').eq('workplace_id', workplaceId).maybeSingle(),
      ids.length ? supabase.from('employee_roles').select('employee_id, role_id').in('employee_id', ids) : Promise.resolve({ data: [] }),
      ids.length ? supabase.from('employee_availability').select('employee_id, day_of_week, shift_type_id').in('employee_id', ids) : Promise.resolve({ data: [] }),
      supabase.from('requests').select('employee_id, day_of_week, is_off, preferred_shift_ids').eq('period_id', periodId),
      supabase.from('assignments').select('employee_id, day_of_week, shift_type_id').eq('period_id', periodId),
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
    }
  }
  for (const r of roles ?? []) employees[r.employee_id]?.roleIds.push(r.role_id)
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

  return { minRestHours: settings?.min_rest_hours ?? 8, keyToShiftTypeId, employees }
}
