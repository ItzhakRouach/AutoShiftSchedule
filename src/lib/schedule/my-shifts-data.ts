/**
 * Loads the raw rows behind the employee home's "my shifts": the published
 * weeks around now and this employee's assignments in them. Assembly into
 * display weeks is pure — see my-shifts.ts.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDaysISO, todayInIsraelISO } from '@/lib/dates/week'
import { fetchRolesAll, fetchShiftTypes } from './cached-reads'
import { buildMyWeek, fromCurrentWeek, type MyAssignmentRow, type MyWeek } from './my-shifts'

/** The week in progress (if published) and the next published week, oldest first. */
export async function getMyWeeks(
  supabase: SupabaseClient,
  employeeId: string,
  workplaceId: string,
  zone: string,
  now: Date = new Date(),
): Promise<MyWeek[]> {
  // One week of slack on the lower bound so the week in progress is included
  // whatever weekday it is; fromCurrentWeek trims anything already over.
  const { data: periods } = await supabase
    .from('schedule_periods')
    .select('id, week_start_date')
    .eq('workplace_id', workplaceId)
    .eq('status', 'published')
    .gte('week_start_date', addDaysISO(todayInIsraelISO(now), -7))
    .order('week_start_date', { ascending: true })
    .limit(3)
  const list = periods ?? []
  if (list.length === 0) return []

  const [{ data: assigns }, shiftTypes, roles] = await Promise.all([
    supabase
      .from('assignments')
      .select('period_id, day_of_week, shift_type_id, role_id')
      .eq('employee_id', employeeId)
      .in('period_id', list.map((p) => p.id as string)),
    fetchShiftTypes(supabase, workplaceId),
    fetchRolesAll(supabase, workplaceId),
  ])

  const roleNameById = new Map(roles.map((r) => [r.id as string, r.name as string]))
  const rowsByPeriod = new Map<string, MyAssignmentRow[]>()
  for (const a of assigns ?? []) {
    const rows = rowsByPeriod.get(a.period_id as string) ?? []
    rows.push(a as MyAssignmentRow)
    rowsByPeriod.set(a.period_id as string, rows)
  }
  const weeks = list.map((p) =>
    buildMyWeek(p.week_start_date as string, rowsByPeriod.get(p.id as string) ?? [], shiftTypes, roleNameById, zone),
  )
  return fromCurrentWeek(weeks, now.getTime(), zone).slice(0, 2)
}
