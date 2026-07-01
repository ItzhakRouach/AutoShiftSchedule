import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computePriorWeekTail } from './prior-tail'
import { findPriorPublishedPeriod, findAdjacentPeriod, type PriorPeriodRow } from './prior-period'
import { computePriorMetrics } from './prior-metrics'
import { computeNextWeekHead } from './next-head'

/**
 * Fetch employee↔role links WITH per-role seniority. `is_senior` is an additive
 * column (migration 20260608000002); if it isn't present yet (code deployed
 * ahead of the migration, or an older DB), fall back to the seniority-free
 * select so scheduling keeps working — everyone is treated as a regular holder.
 */
async function fetchEmployeeRoles(
  supabase: SupabaseClient,
  employeeIds: string[],
): Promise<{ data: { employee_id: string; role_id: string; is_senior?: boolean }[] | null }> {
  const withSenior = await supabase
    .from('employee_roles')
    .select('employee_id, role_id, is_senior')
    .in('employee_id', employeeIds)
  if (!withSenior.error) return { data: withSenior.data }
  const base = await supabase
    .from('employee_roles')
    .select('employee_id, role_id')
    .in('employee_id', employeeIds)
  return { data: base.data }
}

/** Everything that depends ONLY on workplace_id / week_start_date / period_id —
 *  i.e. is knowable right after the `schedule_periods` row loads. Includes the
 *  adjacent/prior period lookups: those filter by workplace_id + a computed
 *  target date, never by employee, so they start in this stage too. */
export async function fetchWorkplaceScoped(
  supabase: SupabaseClient,
  workplaceId: string,
  periodId: string,
  weekStart: string,
  weekDatesArr: string[],
  dayAfterISO: string,
) {
  const [
    { data: shiftTypes },
    { data: roles },
    { data: employees },
    { data: requirements },
    { data: settings },
    { data: requests },
    { data: holidayRows },
    { data: dayNotesRaw },
    prior,
    priorAdjacent,
    nextAdjacent,
  ] = await Promise.all([
    supabase.from('shift_types').select('id, key, is_fallback').eq('workplace_id', workplaceId),
    supabase.from('roles').select('id, name, rank').eq('workplace_id', workplaceId),
    supabase
      .from('employees')
      .select(
        'id, employment_type, min_shifts_per_week, max_shifts_per_week, observes_shabbat, observes_holidays, must_accept',
      )
      .eq('workplace_id', workplaceId),
    supabase
      .from('shift_requirements')
      .select('day_of_week, shift_type_id, role_id, count')
      .eq('workplace_id', workplaceId),
    supabase
      .from('workplace_settings')
      .select('min_rest_hours, ideal_rest_hours, allow_12h_fallback')
      .eq('workplace_id', workplaceId)
      .maybeSingle(),
    supabase
      .from('requests')
      .select('employee_id, day_of_week, is_off, preferred_shift_ids')
      .eq('period_id', periodId),
    supabase
      .from('holidays')
      .select('date')
      .eq('workplace_id', workplaceId)
      .gte('date', weekDatesArr[0])
      .lte('date', dayAfterISO),
    // רענון / day notes for this period → reserve those employees (hard off).
    supabase.from('day_notes').select('employee_id, day_of_week').eq('period_id', periodId),
    findPriorPublishedPeriod(supabase, workplaceId, weekStart),
    findAdjacentPeriod(supabase, workplaceId, weekStart, -7),
    findAdjacentPeriod(supabase, workplaceId, weekStart, 7),
  ])

  return {
    shiftTypes,
    roles,
    employees,
    requirements,
    settings,
    requests,
    holidayRows,
    dayNotesRaw,
    prior,
    priorAdjacent,
    nextAdjacent,
  }
}

/** Everything that depends on the STAGE-2 results: the employee id list (for
 *  the `.in('employee_id', …)` filters) and the resolved prior/adjacent period
 *  rows (for the cross-week metric/tail/head computations). */
export async function fetchEmployeeScoped(
  supabase: SupabaseClient,
  workplaceId: string,
  employeeIds: string[],
  employees: { id: string; min_shifts_per_week: number | null }[],
  prior: PriorPeriodRow | null,
  priorAdjacent: PriorPeriodRow | null,
  nextAdjacent: PriorPeriodRow | null,
  weekStart: string,
) {
  const [
    [{ data: employeeRoles }, { data: availability }, { data: vacations }],
    { deficit: priorDeficit, extras: priorExtras },
    priorWeekTail,
    nextWeekHead,
  ] = await Promise.all([
    employeeIds.length > 0
      ? Promise.all([
          fetchEmployeeRoles(supabase, employeeIds),
          supabase
            .from('employee_availability')
            .select('employee_id, day_of_week, shift_type_id')
            .in('employee_id', employeeIds),
          supabase
            .from('employee_vacations')
            .select('employee_id, date_from, date_to')
            .in('employee_id', employeeIds)
            .eq('status', 'approved'), // only manager-approved vacations are time off
        ])
      : Promise.resolve([{ data: [] as never[] }, { data: [] as never[] }, { data: [] as never[] }]),
    computePriorMetrics(supabase, prior, employees),
    computePriorWeekTail(supabase, workplaceId, priorAdjacent, weekStart),
    computeNextWeekHead(supabase, workplaceId, nextAdjacent, weekStart),
  ])

  return { employeeRoles, availability, vacations, priorDeficit, priorExtras, priorWeekTail, nextWeekHead }
}
