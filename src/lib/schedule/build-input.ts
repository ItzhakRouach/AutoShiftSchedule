import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EngineInput } from '@/lib/scheduling/types'
import {
  mapToEngineInput,
  seedFromUuid,
  weekDatesFrom,
  type MapInput,
} from './map-rows'
import { fetchWorkplaceScoped, fetchEmployeeScoped } from './fetch-stages'

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

// Cross-week fairness (deficit + extras) lives in prior-metrics. Re-export the
// per-metric functions for the unit tests that import them from here; the hot
// path uses computePriorMetrics (one assignments fetch, not two).
export { computePriorDeficit, computePriorExtras } from './prior-metrics'

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
  const weekStart = period.week_start_date as string

  // For holiday-eve detection on the last day we need the day after the week ends.
  // Depends only on stage-1's week_start_date, so it's ready before stage 2 fires.
  const weekDatesArr = weekDatesFrom(period.week_start_date)
  const lastDate = weekDatesArr[6]
  const [y, m, d] = lastDate.split('-').map(Number)
  const dayAfter = new Date(Date.UTC(y, m - 1, d))
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1)
  const dayAfterISO = `${dayAfter.getUTCFullYear()}-${String(dayAfter.getUTCMonth() + 1).padStart(2, '0')}-${String(dayAfter.getUTCDate()).padStart(2, '0')}`

  // Stage 2: everything needing only workplace_id/week_start_date/period_id —
  // including the prior/adjacent period lookups, which filter by workplace_id
  // + a computed date and never touch the employee list.
  const {
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
  } = await fetchWorkplaceScoped(supabase, wp, periodId, weekStart, weekDatesArr, dayAfterISO)

  const employeeIds = (employees ?? []).map((e) => e.id)
  const holidayDates = new Set<string>((holidayRows ?? []).map((h: { date: string }) => h.date))

  // Stage 3: depends on stage-2 results — the employee id list (for the
  // `.in('employee_id', …)` filters) and the resolved prior/adjacent period
  // rows (for the cross-week metric/tail/head computations).
  const { employeeRoles, availability, vacations, priorDeficit, priorExtras, priorWeekTail, nextWeekHead } =
    await fetchEmployeeScoped(
      supabase,
      wp,
      employeeIds,
      employees ?? [],
      prior,
      priorAdjacent,
      nextAdjacent,
      weekStart,
    )

  const rows: MapInput = {
    weekDates: weekDatesArr,
    shiftTypes: shiftTypes ?? [],
    roles: roles ?? [],
    employees: employees ?? [],
    employeeRoles: employeeRoles ?? [],
    availability: availability ?? [],
    requests: requests ?? [],
    vacations: vacations ?? [],
    dayNotes: dayNotesRaw ?? [],
    requirements: requirements ?? [],
    settings: settings ?? null,
    seed: seedFromUuid(period.id),
    holidayDates,
    priorDeficit,
    priorExtras,
    priorWeekTail,
    nextWeekHead,
  }

  const { input, keyToShiftTypeId, nameToRoleId } = mapToEngineInput(rows)
  const allKeyToShiftTypeId: Record<string, string> = {}
  for (const st of shiftTypes ?? []) allKeyToShiftTypeId[st.key] = st.id
  return { input, keyToShiftTypeId, allKeyToShiftTypeId, nameToRoleId, period: period as PeriodInfo }
}
