/**
 * Loads the current employee's personal shift summary for the latest published
 * period. Returns null when no schedule is published yet.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { summarizeEmployee, type EmployeeSummary } from './employee-summary'

export async function getMeSummary(
  supabase: SupabaseClient,
  employeeId: string,
  workplaceId: string,
): Promise<EmployeeSummary | null> {
  const { data: period } = await supabase
    .from('schedule_periods')
    .select('id')
    .eq('workplace_id', workplaceId)
    .eq('status', 'published')
    .order('week_start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!period) return null

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
    supabase.from('roles').select('id, name').eq('workplace_id', workplaceId),
  ])

  const shiftKeyById = new Map((shiftTypes ?? []).map((s) => [s.id, s.key]))
  const roleNameById = new Map((roles ?? []).map((r) => [r.id, r.name]))
  return summarizeEmployee(assigns ?? [], reqs ?? [], shiftKeyById, roleNameById)
}
