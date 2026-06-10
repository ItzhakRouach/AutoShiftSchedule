/**
 * Loads the current employee's personal shift summary for the latest published
 * period. Returns null when no schedule is published yet.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { summarizeEmployee, type EmployeeSummary } from './employee-summary'
import type { Scope } from './types'

export interface MeSummaryRole { name: string; color: string }
export interface MeSummaryData {
  summary: EmployeeSummary
  /** Active roles of the workplace (name + color) for the breakdown display. */
  roles: MeSummaryRole[]
}

export async function getMeSummary(
  supabase: SupabaseClient,
  employeeId: string,
  workplaceId: string,
): Promise<MeSummaryData | null> {
  // Current period only, and only while published — never fall back to an older
  // published week (mirrors getPublishedScheduleView so the summary disappears
  // when the manager unpublishes/clears the current schedule).
  const { data: period } = await supabase
    .from('schedule_periods')
    .select('id, status')
    .eq('workplace_id', workplaceId)
    .order('week_start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!period || period.status !== 'published') return null

  const [{ data: assigns }, { data: reqs }, { data: shiftTypes }, { data: roles }] = await Promise.all([
    supabase
      .from('assignments')
      .select('day_of_week, shift_type_id, role_id')
      .eq('period_id', period.id)
      .eq('employee_id', employeeId),
    supabase
      .from('requests')
      .select('day_of_week, is_off, preferred_shift_ids')
      .eq('period_id', period.id)
      .eq('employee_id', employeeId),
    supabase.from('shift_types').select('id, key').eq('workplace_id', workplaceId),
    supabase.from('roles').select('id, name, color, rank').eq('workplace_id', workplaceId).eq('is_active', true).order('rank', { ascending: false }),
  ])

  const shiftKeyById = new Map((shiftTypes ?? []).map((s) => [s.id, s.key]))
  const roleNameById = new Map((roles ?? []).map((r) => [r.id, r.name]))
  const summary = summarizeEmployee(assigns ?? [], reqs ?? [], shiftKeyById, roleNameById)
  const roleList: MeSummaryRole[] = (roles ?? []).map((r) => ({ name: r.name, color: r.color ?? '#888888' }))
  return { summary, roles: roleList }
}

export interface ScopedBreakdown {
  total: number
  byRole: Record<string, number>
  byShiftType: Record<string, number>
}
export interface MeStatsData {
  week: ScopedBreakdown
  month: ScopedBreakdown
  year: ScopedBreakdown
  roles: MeSummaryRole[]
}

function scopeStart(scope: Scope): string {
  const d = new Date()
  if (scope === 'month') d.setDate(d.getDate() - 31)
  else if (scope === 'year') d.setDate(d.getDate() - 365)
  else d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

/**
 * The employee's shift volume + role/shift-type breakdown across PUBLISHED
 * periods, for week / month / year scopes. One fetch (last 365d of periods),
 * aggregated per scope, so the UI can toggle instantly with no extra round-trip.
 */
export async function getMeStats(
  supabase: SupabaseClient,
  employeeId: string,
  workplaceId: string,
): Promise<MeStatsData> {
  const yearStart = scopeStart('year')
  const { data: periods } = await supabase
    .from('schedule_periods')
    .select('id, week_start_date')
    .eq('workplace_id', workplaceId)
    .eq('status', 'published')
    .gte('week_start_date', yearStart)
  const periodList = periods ?? []
  const periodIds = periodList.map((p) => p.id as string)

  const [{ data: shiftTypes }, { data: roles }, assignsRes] = await Promise.all([
    supabase.from('shift_types').select('id, key').eq('workplace_id', workplaceId),
    supabase.from('roles').select('id, name, color, rank').eq('workplace_id', workplaceId).eq('is_active', true).order('rank', { ascending: false }),
    periodIds.length
      ? supabase.from('assignments').select('period_id, day_of_week, shift_type_id, role_id').eq('employee_id', employeeId).in('period_id', periodIds)
      : Promise.resolve({ data: [] as { period_id: string; day_of_week: number; shift_type_id: string; role_id: string }[] }),
  ])

  const shiftKeyById = new Map((shiftTypes ?? []).map((s) => [s.id, s.key]))
  const roleNameById = new Map((roles ?? []).map((r) => [r.id, r.name]))
  const roleList: MeSummaryRole[] = (roles ?? []).map((r) => ({ name: r.name, color: r.color ?? '#888888' }))
  const weekStartById = new Map(periodList.map((p) => [p.id as string, p.week_start_date as string]))
  const assigns = assignsRes.data ?? []

  const breakdown = (scope: Scope): ScopedBreakdown => {
    const start = scopeStart(scope)
    const inScope = assigns.filter((a) => (weekStartById.get(a.period_id) ?? '') >= start)
    const s = summarizeEmployee(
      inScope.map((a) => ({ day_of_week: a.day_of_week, shift_type_id: a.shift_type_id, role_id: a.role_id })),
      [],
      shiftKeyById,
      roleNameById,
    )
    return { total: s.total, byRole: s.byRole, byShiftType: s.byShiftType }
  }

  return { week: breakdown('week'), month: breakdown('month'), year: breakdown('year'), roles: roleList }
}
