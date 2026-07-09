import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computePriorWeekTail } from './prior-tail'
import { findPriorPublishedPeriod, findAdjacentPeriod, type PriorPeriodRow } from './prior-period'
import { computePriorMetrics } from './prior-metrics'
import { computeNextWeekHead } from './next-head'
import {
  fetchApprovedVacations,
  fetchAvailability,
  fetchEmployeeRoles,
  fetchEmployeesFull,
  fetchRequests,
  fetchRolesAll,
  fetchSettings,
  fetchShiftTypes,
} from './cached-reads'

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
  // Shared tables go through the per-request cached readers (deduped with
  // view-data / edit-meta); period-specific + range queries stay direct.
  const [
    shiftTypes,
    roles,
    employees,
    { data: requirements },
    settings,
    requests,
    { data: holidayRows },
    { data: dayNotesRaw },
    prior,
    priorAdjacent,
    nextAdjacent,
  ] = await Promise.all([
    fetchShiftTypes(supabase, workplaceId),
    fetchRolesAll(supabase, workplaceId),
    fetchEmployeesFull(supabase, workplaceId),
    supabase
      .from('shift_requirements')
      .select('day_of_week, shift_type_id, role_id, count')
      .eq('workplace_id', workplaceId),
    fetchSettings(supabase, workplaceId),
    fetchRequests(supabase, periodId),
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

export interface FetchEmployeeScopedArgs {
  supabase: SupabaseClient
  workplaceId: string
  employeeIds: string[]
  employees: { id: string; min_shifts_per_week: number | null }[]
  /** PUBLISHED prior period (fairness deficit/extras count ONLY this status). */
  prior: PriorPeriodRow | null
  /** Immediately-preceding period regardless of status (rest tail carry-over). */
  priorAdjacent: PriorPeriodRow | null
  /** Immediately-following period regardless of status (rest head carry-over). */
  nextAdjacent: PriorPeriodRow | null
  weekStart: string
}

/** Everything that depends on the STAGE-2 results: the employee id list (for
 *  the `.in('employee_id', …)` filters) and the resolved prior/adjacent period
 *  rows (for the cross-week metric/tail/head computations). Named-params object
 *  (not positional) because 3 same-typed `PriorPeriodRow | null` args in a row
 *  is a transposition hazard that would silently corrupt fairness+rest. */
export async function fetchEmployeeScoped(args: FetchEmployeeScopedArgs) {
  const { supabase, workplaceId, employeeIds, employees, prior, priorAdjacent, nextAdjacent, weekStart } = args
  const [
    [employeeRoles, availability, vacations],
    { deficit: priorDeficit, extras: priorExtras },
    priorWeekTail,
    nextWeekHead,
  ] = await Promise.all([
    employeeIds.length > 0
      ? Promise.all([
          // Cached per-request readers, shared with view-data/edit-meta. Rows
          // come back roster-wide (same set as employeeIds — both derive from
          // the workplace's employees); vacations are approved-only there too.
          fetchEmployeeRoles(supabase, workplaceId),
          fetchAvailability(supabase, workplaceId),
          fetchApprovedVacations(supabase, workplaceId),
        ])
      : Promise.resolve([[] as never[], [] as never[], [] as never[]]),
    // fairness counts only the PUBLISHED prior period.
    computePriorMetrics(supabase, prior, employees),
    // rest tail/head use the ADJACENT periods regardless of status.
    computePriorWeekTail(supabase, workplaceId, priorAdjacent, weekStart),
    computeNextWeekHead(supabase, workplaceId, nextAdjacent, weekStart),
  ])

  return { employeeRoles, availability, vacations, priorDeficit, priorExtras, priorWeekTail, nextWeekHead }
}
