/**
 * Loads the current employee's personal shift summary for the latest published
 * period. Returns null when no schedule is published yet.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { summarizeEmployee, type EmployeeSummary } from './employee-summary'
import { currentWeekStartISO } from '@/lib/dates/week'
import { fetchRolesAll, fetchShiftTypes } from '@/lib/schedule/cached-reads'
import type { Scope } from './types'

/** Active roles, rank-desc — deduped per request via fetchRolesAll. */
async function activeRoles(supabase: SupabaseClient, workplaceId: string) {
  return (await fetchRolesAll(supabase, workplaceId)).filter((r) => r.is_active)
}

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
  // The CURRENT schedule week — the latest period that has already started
  // (weekStart ≤ this week's Sunday), and only while published. Bounding by the
  // current week means a schedule published ahead for next week doesn't replace
  // the week-in-progress summary; it flips on Sunday. Returns null when the
  // current week isn't published (unpublished/cleared/not yet scheduled).
  const { data: period } = await supabase
    .from('schedule_periods')
    .select('id, status')
    .eq('workplace_id', workplaceId)
    .lte('week_start_date', currentWeekStartISO(new Date()))
    .order('week_start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!period || period.status !== 'published') return null

  const [{ data: assigns }, { data: reqs }, shiftTypes, roles] = await Promise.all([
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
    fetchShiftTypes(supabase, workplaceId),
    activeRoles(supabase, workplaceId),
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

/**
 * Whether a period's `weekStartISO` belongs to the selected stats scope, keyed
 * to the calendar: week = exactly the current schedule week; month = any week
 * whose start falls in the current calendar month (INCLUDING upcoming scheduled
 * weeks in this month); year = any week in the current calendar year. Pure.
 */
export function matchesStatScope(
  weekStartISO: string,
  scope: Scope,
  ctx: { weekTarget: string; monthKey: string; yearKey: string },
): boolean {
  if (scope === 'week') return weekStartISO === ctx.weekTarget
  if (scope === 'month') return weekStartISO.slice(0, 7) === ctx.monthKey
  return weekStartISO.slice(0, 4) === ctx.yearKey
}

/**
 * The employee's shift volume + role/shift-type breakdown across PUBLISHED
 * periods, for week / month / year scopes. One fetch (this calendar year's
 * periods), aggregated per scope, so the UI can toggle instantly with no extra
 * round-trip. Scopes are calendar boundaries (this week/month/year), not rolling
 * day-windows — see scopeStartISO.
 */
export async function getMeStats(
  supabase: SupabaseClient,
  employeeId: string,
  workplaceId: string,
): Promise<MeStatsData> {
  const now = new Date()
  const yearStart = `${now.getFullYear()}-01-01`
  const { data: periods } = await supabase
    .from('schedule_periods')
    .select('id, week_start_date')
    .eq('workplace_id', workplaceId)
    .eq('status', 'published')
    .gte('week_start_date', yearStart)
  const periodList = periods ?? []
  const periodIds = periodList.map((p) => p.id as string)

  const [shiftTypes, roles, assignsRes] = await Promise.all([
    fetchShiftTypes(supabase, workplaceId),
    activeRoles(supabase, workplaceId),
    periodIds.length
      ? supabase.from('assignments').select('period_id, day_of_week, shift_type_id, role_id').eq('employee_id', employeeId).in('period_id', periodIds)
      : Promise.resolve({ data: [] as { period_id: string; day_of_week: number; shift_type_id: string; role_id: string }[] }),
  ])

  const shiftKeyById = new Map((shiftTypes ?? []).map((s) => [s.id, s.key]))
  const roleNameById = new Map((roles ?? []).map((r) => [r.id, r.name]))
  const roleList: MeSummaryRole[] = (roles ?? []).map((r) => ({ name: r.name, color: r.color ?? '#888888' }))
  const weekStartById = new Map(periodList.map((p) => [p.id as string, p.week_start_date as string]))
  const assigns = assignsRes.data ?? []
  // "week" = the CURRENT schedule week (latest published week that has already
  // started, weekStart ≤ this week's Sunday). "month"/"year" bucket by the
  // week-start's calendar month/year — so an upcoming week within THIS month
  // (e.g. next Sunday) counts toward "month", but a week in the next month does
  // not. See matchesStatScope.
  const cw = currentWeekStartISO(now)
  const weekTarget = periodList.reduce((max, p) => {
    const ws = p.week_start_date as string
    return ws <= cw && ws > max ? ws : max
  }, '')
  const ctx = {
    weekTarget,
    monthKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    yearKey: String(now.getFullYear()),
  }

  const breakdown = (scope: Scope): ScopedBreakdown => {
    const inScope = assigns.filter((a) =>
      matchesStatScope(weekStartById.get(a.period_id) ?? '', scope, ctx),
    )
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
