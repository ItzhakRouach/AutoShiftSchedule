import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Scope, DashboardStats } from './types'
import {
  aggregateKPIs,
  aggregateEmployees,
  aggregateFairness,
} from './aggregate'

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
  // 1. Employees
  const { data: empRaw } = await supabase
    .from('employees')
    .select('id, name, color, min_shifts_per_week')
    .eq('workplace_id', workplaceId)
    .order('name')

  const employees = empRaw ?? []
  if (employees.length === 0) {
    return {
      kpis: EMPTY_KPIS,
      employees: [],
      fairness: [],
    }
  }

  // 2. Shift types (id → key, id → hours, id → is_fallback)
  const { data: shiftTypesRaw } = await supabase
    .from('shift_types')
    .select('id, key, hours, is_fallback')
    .eq('workplace_id', workplaceId)
  const shiftTypes = shiftTypesRaw ?? []
  const hoursById = new Map<string, number>(shiftTypes.map((s) => [s.id, s.hours]))
  const keyById = new Map<string, string>(shiftTypes.map((s) => [s.id, s.key]))
  const fallbackById = new Map<string, boolean>(
    shiftTypes.map((s) => [s.id, s.is_fallback ?? s.hours >= 12]),
  )

  // 3. Periods — latest 1 for current period; scope range for charts
  let periodsQuery = supabase
    .from('schedule_periods')
    .select('id, week_start_date, status')
    .eq('workplace_id', workplaceId)
    .order('week_start_date', { ascending: false })

  const startDate = scope === 'week' ? null : scopeStartDate(scope)
  if (startDate) {
    periodsQuery = periodsQuery.gte('week_start_date', startDate)
  } else {
    periodsQuery = periodsQuery.limit(1)
  }

  const { data: periodsRaw } = await periodsQuery
  const periods = periodsRaw ?? []

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

  // 5. Coverage from latest period requirements
  const { data: reqRaw } = await supabase
    .from('shift_requirements')
    .select('count')
    .eq('period_id', latestPeriodId)

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
    ),
    employees: aggregateEmployees(allAssignments, employees),
    fairness: aggregateFairness(allAssignments, requests, employees, keyById),
  }
}
