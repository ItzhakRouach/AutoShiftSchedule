import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Scope, DashboardStats } from './types'
import {
  aggregateKPIs,
  aggregateEmployees,
  aggregateFairness,
} from './aggregate'
import { buildWeeklyTrends } from './trends'
import { scopeStartISO } from '@/lib/dates/scope'

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
  // Batch A — everything keyed only by workplaceId: employees, shift types,
  // weekly required headcount, and the in-scope periods. (Periods: WEEK = the
  // CURRENT period, latest by date, counted only if published; MONTH/YEAR = all
  // published periods in the calendar range.)
  const periodsQuery =
    scope === 'week'
      ? supabase
          .from('schedule_periods')
          .select('id, week_start_date, status')
          .eq('workplace_id', workplaceId)
          .order('week_start_date', { ascending: false })
          .limit(1)
          .maybeSingle()
      : supabase
          .from('schedule_periods')
          .select('id, week_start_date, status')
          .eq('workplace_id', workplaceId)
          .eq('status', 'published')
          .gte('week_start_date', scopeStartISO(scope, new Date()))
          .order('week_start_date', { ascending: false })

  const [{ data: empRaw }, { data: shiftTypesRaw }, { data: reqRaw }, periodsRes] = await Promise.all([
    supabase.from('employees').select('id, name, color, min_shifts_per_week').eq('workplace_id', workplaceId).order('name'),
    supabase.from('shift_types').select('id, key, hours, is_fallback').eq('workplace_id', workplaceId),
    // shift_requirements is WEEK-shaped, keyed by workplace_id (no period_id column).
    supabase.from('shift_requirements').select('count').eq('workplace_id', workplaceId),
    periodsQuery,
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

  const periods: { id: string; week_start_date: string; status: string }[] =
    scope === 'week'
      ? (() => {
          const latest = periodsRes.data as { id: string; week_start_date: string; status: string } | null
          return latest && latest.status === 'published' ? [latest] : []
        })()
      : ((periodsRes.data as { id: string; week_start_date: string; status: string }[] | null) ?? [])

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

  // Batch B — both keyed by the resolved periodIds, mutually independent.
  const [{ data: assignRaw }, { data: reqsRaw }] = await Promise.all([
    supabase
      .from('assignments')
      .select('employee_id, day_of_week, shift_type_id, role_id, period_id')
      .in('period_id', periodIds),
    supabase
      .from('requests')
      .select('employee_id, period_id, day_of_week, is_off, preferred_shift_ids')
      .in('period_id', periodIds),
  ])

  const allAssignments = (assignRaw ?? []).map((a) => ({
    ...a,
    hours: hoursById.get(a.shift_type_id) ?? 0,
    is_fallback: fallbackById.get(a.shift_type_id) ?? false,
  }))

  // Period assignments = latest period only (for KPI accuracy)
  const periodAssignments = allAssignments.filter((a) => a.period_id === latestPeriodId)

  const required = (reqRaw ?? []).reduce((s: number, r: { count: number }) => s + r.count, 0)
  const requirementSummary = { filled: periodAssignments.length, required }

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
