import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Scope, DashboardStats } from './types'
import {
  aggregateKPIs,
  aggregateEmployees,
  aggregateFairness,
} from './aggregate'
import { buildWeeklyTrends } from './trends'

function scopeStartDate(scope: Scope): string {
  const d = new Date()
  if (scope === 'month') d.setDate(d.getDate() - 31)
  else if (scope === 'year') d.setDate(d.getDate() - 365)
  else d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

const EMPTY_KPIS = {
  coveragePct: null,
  coverageColor: 'red' as const,
  filledSlots: 0,
  requiredSlots: 0,
  uncoveredSlots: 0,
  shifts12h: 0,
  belowMinCount: 0,
  twoRequestsHonoredCount: 0,
  twoRequestsHonoredTotal: 0,
  activeEmployees: 0,
}

export async function fetchDashboardStats(
  supabase: SupabaseClient,
  workplaceId: string,
  scope: Scope,
): Promise<DashboardStats | null> {
  // 1+2. Employees + shift types — independent, fetched in parallel.
  const [{ data: empRaw }, { data: shiftTypesRaw }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, name, color, min_shifts_per_week')
      .eq('workplace_id', workplaceId)
      .order('name'),
    supabase
      .from('shift_types')
      .select('id, key, hours, is_fallback')
      .eq('workplace_id', workplaceId),
  ])

  const employees = empRaw ?? []
  if (employees.length === 0) {
    return {
      kpis: EMPTY_KPIS,
      employees: [],
      fairness: [],
      trends: [],
    }
  }

  const shiftTypes = shiftTypesRaw ?? []
  const hoursById = new Map<string, number>(shiftTypes.map((s) => [s.id, s.hours]))
  const keyById = new Map<string, string>(shiftTypes.map((s) => [s.id, s.key]))
  const fallbackById = new Map<string, boolean>(
    shiftTypes.map((s) => [s.id, s.is_fallback ?? s.hours >= 12]),
  )

  // 3. Periods. WEEK = the CURRENT period (latest by date), counted ONLY if it's
  // published — so unpublishing/deleting it (or never generating one) shows an
  // empty dashboard, and we never fall back to a stale older published week.
  // MONTH/YEAR = all published periods in the range (cumulative history charts).
  let periods: { id: string; week_start_date: string; status: string }[]
  if (scope === 'week') {
    const { data: latest } = await supabase
      .from('schedule_periods')
      .select('id, week_start_date, status')
      .eq('workplace_id', workplaceId)
      .order('week_start_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    periods = latest && latest.status === 'published' ? [latest] : []
  } else {
    const { data } = await supabase
      .from('schedule_periods')
      .select('id, week_start_date, status')
      .eq('workplace_id', workplaceId)
      .eq('status', 'published')
      .gte('week_start_date', scopeStartDate(scope))
      .order('week_start_date', { ascending: false })
    periods = data ?? []
  }

  if (periods.length === 0) {
    return {
      kpis: { ...EMPTY_KPIS, activeEmployees: employees.length },
      employees: employees.map((e) => ({ ...e, shifts: 0, hours: 0 })),
      fairness: employees.map((e) => ({
        id: e.id,
        name: e.name,
        nightShifts: 0,
        weekendShifts: 0,
        requestedCount: 0,
        honoredCount: 0,
      })),
      trends: [],
    }
  }

  const periodIds = periods.map((p) => p.id)
  const latestPeriodId = periods[0].id

  // 4. All assignments for scope
  const { data: assignRaw } = await supabase
    .from('assignments')
    .select('employee_id, day_of_week, shift_type_id, role_id, period_id')
    .in('period_id', periodIds)

  const allAssignments = (assignRaw ?? []).map((a) => ({
    ...a,
    hours: hoursById.get(a.shift_type_id) ?? 0,
    is_fallback: fallbackById.get(a.shift_type_id) ?? false,
  }))

  // Period assignments = latest period only (for KPI accuracy)
  const periodAssignments = allAssignments.filter((a) => a.period_id === latestPeriodId)

  // 5. Weekly required headcount. shift_requirements is WEEK-shaped and keyed
  // by workplace_id (it has NO period_id column — the old .eq('period_id', …)
  // filter errored and silently zeroed the coverage KPI).
  const { data: reqRaw } = await supabase
    .from('shift_requirements')
    .select('count')
    .eq('workplace_id', workplaceId)

  const required = (reqRaw ?? []).reduce((s: number, r: { count: number }) => s + r.count, 0)
  const requirementSummary = { filled: periodAssignments.length, required }

  // 6. Requests for latest period (for KPI ≥2-honored)
  const { data: reqsRaw } = await supabase
    .from('requests')
    .select('employee_id, period_id, day_of_week, is_off, preferred_shift_ids')
    .in('period_id', periodIds)
  const requests = reqsRaw ?? []
  const latestRequests = requests.filter((r) => r.period_id === latestPeriodId)

  return {
    kpis: aggregateKPIs(
      periodAssignments,
      employees,
      requirementSummary,
      latestRequests,
      keyById,
    ),
    employees: aggregateEmployees(allAssignments, employees),
    fairness: aggregateFairness(allAssignments, requests, employees, keyById),
    trends: buildWeeklyTrends(periods, allAssignments, requests, required, keyById),
  }
}
