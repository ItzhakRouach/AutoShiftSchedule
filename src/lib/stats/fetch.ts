import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Scope, DashboardStats } from './types'
import {
  aggregateKPIs,
  aggregateEmployees,
  aggregateRoles,
  aggregateFairness,
} from './aggregate'

function scopeStartDate(scope: Scope): string {
  const d = new Date()
  if (scope === 'month') d.setDate(d.getDate() - 31)
  else if (scope === 'year') d.setDate(d.getDate() - 365)
  else d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

export async function fetchDashboardStats(
  supabase: SupabaseClient,
  workplaceId: string,
  scope: Scope,
): Promise<DashboardStats | null> {
  // 1. Employees
  const { data: empRaw } = await supabase
    .from('employees')
    .select('id, name, color')
    .eq('workplace_id', workplaceId)
    .order('name')

  const employees = empRaw ?? []
  if (employees.length === 0) {
    return {
      kpis: { activeEmployees: 0, totalShifts: 0, totalHours: 0, coveragePct: null },
      employees: [],
      roles: [],
      fairness: [],
    }
  }

  // 2. Roles
  const { data: rolesRaw } = await supabase
    .from('roles')
    .select('id, name, color')
    .eq('workplace_id', workplaceId)
    .order('name')
  const roles = rolesRaw ?? []

  // 3. Shift types (id → key, id → hours)
  const { data: shiftTypesRaw } = await supabase
    .from('shift_types')
    .select('id, key, hours')
    .eq('workplace_id', workplaceId)
  const shiftTypes = shiftTypesRaw ?? []
  const hoursById = new Map<string, number>(shiftTypes.map((s) => [s.id, s.hours]))
  const keyById = new Map<string, string>(shiftTypes.map((s) => [s.id, s.key]))

  // 4. Periods in scope
  const startDate = scope === 'week' ? null : scopeStartDate(scope)
  let periodsQuery = supabase
    .from('schedule_periods')
    .select('id, week_start_date, status')
    .eq('workplace_id', workplaceId)
    .order('week_start_date', { ascending: false })

  if (startDate) {
    periodsQuery = periodsQuery.gte('week_start_date', startDate)
  } else {
    periodsQuery = periodsQuery.limit(1)
  }

  const { data: periodsRaw } = await periodsQuery
  const periods = periodsRaw ?? []

  if (periods.length === 0) {
    return {
      kpis: {
        activeEmployees: employees.length,
        totalShifts: 0,
        totalHours: 0,
        coveragePct: null,
      },
      employees: employees.map((e) => ({ ...e, shifts: 0, hours: 0 })),
      roles: roles.map((r) => ({ ...r, count: 0 })),
      fairness: employees.map((e) => ({
        id: e.id,
        name: e.name,
        nightShifts: 0,
        weekendShifts: 0,
        requestHonoredPct: null,
      })),
    }
  }

  const periodIds = periods.map((p) => p.id)

  // 5. Assignments for those periods
  const { data: assignRaw } = await supabase
    .from('assignments')
    .select('employee_id, day_of_week, shift_type_id, role_id, period_id')
    .in('period_id', periodIds)
  const assignments = (assignRaw ?? []).map((a) => ({
    ...a,
    hours: hoursById.get(a.shift_type_id) ?? 0,
    is_fallback: false,
  }))

  // 6. Coverage from the latest period
  const latestPeriod = periods[0]
  let requirementSummary: { filled: number; required: number } | null = null
  if (latestPeriod) {
    const { data: reqRaw } = await supabase
      .from('shift_requirements')
      .select('count')
      .eq('period_id', latestPeriod.id)

    const required = (reqRaw ?? []).reduce((s: number, r: { count: number }) => s + r.count, 0)
    // filled = number of assignments in latest period
    const filled = assignments.filter((a) => a.period_id === latestPeriod.id).length
    requirementSummary = { filled, required }
  }

  // 7. Requests for those periods
  const { data: reqsRaw } = await supabase
    .from('requests')
    .select('employee_id, period_id, day_of_week, is_off, preferred_shift_ids')
    .in('period_id', periodIds)
  const requests = reqsRaw ?? []

  return {
    kpis: aggregateKPIs(assignments, employees, requirementSummary),
    employees: aggregateEmployees(assignments, employees),
    roles: aggregateRoles(assignments, roles),
    fairness: aggregateFairness(assignments, requests, employees, keyById),
  }
}
