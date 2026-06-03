import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EngineInput } from '@/lib/scheduling/types'
import {
  mapToEngineInput,
  seedFromUuid,
  weekDatesFrom,
  type MapInput,
} from './map-rows'
import { computePriorWeekTail } from './prior-tail'
import { findPriorPublishedPeriod, type PriorPeriodRow } from './prior-period'

export interface PeriodInfo {
  id: string
  workplace_id: string
  week_start_date: string
  status: string
}

export interface BuiltInput {
  input: EngineInput
  keyToShiftTypeId: Record<string, string>
  /** key → shift_type_id for ALL shift types incl. 12h fallback variants
   *  (needed to persist auto-assigned 12h coverage rows). */
  allKeyToShiftTypeId: Record<string, string>
  nameToRoleId: Record<string, string>
  period: PeriodInfo
}

interface EmpMinRow {
  id: string
  min_shifts_per_week: number | null
}

/**
 * Cross-week minimum fairness. For each employee computes priorDeficit =
 * max(0, minShifts − shiftsThen), where shiftsThen = distinct assigned days in
 * the supplied prior published period (one shift/day, per the assignments
 * unique(period,employee,day) constraint — a 12h counts once). Returns {}
 * (all-zero) when `prior` is null.
 *
 * The caller resolves the prior period once via `findPriorPublishedPeriod` and
 * passes it to BOTH this and `computePriorWeekTail` to avoid two identical
 * lookups per buildEngineInput call.
 */
export async function computePriorDeficit(
  supabase: SupabaseClient,
  prior: PriorPeriodRow | null,
  employees: EmpMinRow[],
): Promise<Record<string, number>> {
  if (!prior) return {}
  const { data: rows } = await supabase
    .from('assignments')
    .select('employee_id, day_of_week')
    .eq('period_id', prior.id)
  // Count DISTINCT (employee, day) pairs — defensive even though the unique
  // constraint already guarantees one row per employee/day.
  const seen = new Set<string>()
  const counts: Record<string, number> = {}
  for (const r of (rows ?? []) as { employee_id: string; day_of_week: number }[]) {
    const k = `${r.employee_id}:${r.day_of_week}`
    if (seen.has(k)) continue
    seen.add(k)
    counts[r.employee_id] = (counts[r.employee_id] ?? 0) + 1
  }
  const deficit: Record<string, number> = {}
  for (const e of employees) {
    const min = e.min_shifts_per_week ?? 0
    deficit[e.id] = Math.max(0, min - (counts[e.id] ?? 0))
  }
  return deficit
}

/**
 * Loads everything the scheduling engine needs for `periodId` from the DB and
 * maps it to the engine's EngineInput. Returns null if the period is missing
 * (e.g. RLS denied). Pure mapping is delegated to mapToEngineInput.
 */
export async function buildEngineInput(
  supabase: SupabaseClient,
  periodId: string,
): Promise<BuiltInput | null> {
  const { data: period } = await supabase
    .from('schedule_periods')
    .select('id, workplace_id, week_start_date, status')
    .eq('id', periodId)
    .maybeSingle()

  if (!period) return null
  const wp = period.workplace_id as string

  const [
    { data: shiftTypes },
    { data: roles },
    { data: employees },
    { data: requirements },
    { data: settings },
    { data: requests },
  ] = await Promise.all([
    supabase.from('shift_types').select('id, key, is_fallback').eq('workplace_id', wp),
    supabase.from('roles').select('id, name, rank').eq('workplace_id', wp),
    supabase
      .from('employees')
      .select(
        'id, employment_type, min_shifts_per_week, max_shifts_per_week, observes_shabbat, observes_holidays, must_accept',
      )
      .eq('workplace_id', wp),
    supabase
      .from('shift_requirements')
      .select('day_of_week, shift_type_id, role_id, count')
      .eq('workplace_id', wp),
    supabase
      .from('workplace_settings')
      .select('min_rest_hours, ideal_rest_hours, allow_12h_fallback')
      .eq('workplace_id', wp)
      .maybeSingle(),
    supabase
      .from('requests')
      .select('employee_id, day_of_week, is_off, preferred_shift_ids')
      .eq('period_id', periodId),
  ])

  const employeeIds = (employees ?? []).map((e) => e.id)
  // For holiday-eve detection on the last day we need the day after the week ends.
  const weekDatesArr = weekDatesFrom(period.week_start_date)
  const lastDate = weekDatesArr[6]
  const [y, m, d] = lastDate.split('-').map(Number)
  const dayAfter = new Date(Date.UTC(y, m - 1, d))
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1)
  const dayAfterISO = `${dayAfter.getUTCFullYear()}-${String(dayAfter.getUTCMonth() + 1).padStart(2, '0')}-${String(dayAfter.getUTCDate()).padStart(2, '0')}`

  const [
    [{ data: employeeRoles }, { data: availability }, { data: vacations }],
    { data: holidayRows },
  ] = await Promise.all([
    employeeIds.length > 0
      ? Promise.all([
          supabase.from('employee_roles').select('employee_id, role_id').in('employee_id', employeeIds),
          supabase
            .from('employee_availability')
            .select('employee_id, day_of_week, shift_type_id')
            .in('employee_id', employeeIds),
          supabase
            .from('employee_vacations')
            .select('employee_id, date_from, date_to')
            .in('employee_id', employeeIds),
        ])
      : Promise.resolve([{ data: [] as never[] }, { data: [] as never[] }, { data: [] as never[] }]),
    supabase
      .from('holidays')
      .select('date')
      .eq('workplace_id', wp)
      .gte('date', weekDatesArr[0])
      .lte('date', dayAfterISO),
  ])

  const holidayDates = new Set<string>((holidayRows ?? []).map((h: { date: string }) => h.date))

  // Resolve the prior published period ONCE and reuse it for both deficit
  // (fairness carry-over) and tail (rest carry-over) — saves a duplicate
  // schedule_periods lookup. The two computations are then run in parallel.
  const prior = await findPriorPublishedPeriod(supabase, wp, period.week_start_date as string)
  const [priorDeficit, priorWeekTail] = await Promise.all([
    computePriorDeficit(supabase, prior, employees ?? []),
    computePriorWeekTail(supabase, wp, prior, period.week_start_date as string),
  ])

  const rows: MapInput = {
    weekDates: weekDatesArr,
    shiftTypes: shiftTypes ?? [],
    roles: roles ?? [],
    employees: employees ?? [],
    employeeRoles: employeeRoles ?? [],
    availability: availability ?? [],
    requests: requests ?? [],
    vacations: vacations ?? [],
    requirements: requirements ?? [],
    settings: settings ?? null,
    seed: seedFromUuid(period.id),
    holidayDates,
    priorDeficit,
    priorWeekTail,
  }

  const { input, keyToShiftTypeId, nameToRoleId } = mapToEngineInput(rows)
  const allKeyToShiftTypeId: Record<string, string> = {}
  for (const st of shiftTypes ?? []) allKeyToShiftTypeId[st.key] = st.id
  return { input, keyToShiftTypeId, allKeyToShiftTypeId, nameToRoleId, period: period as PeriodInfo }
}
