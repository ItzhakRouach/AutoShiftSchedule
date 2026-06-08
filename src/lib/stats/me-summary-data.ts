/**
 * Loads the current employee's personal shift summary for the latest published
 * period. Returns null when no schedule is published yet.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { summarizeEmployee, type EmployeeSummary } from './employee-summary'

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
