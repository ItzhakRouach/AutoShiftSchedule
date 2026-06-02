import type { SupabaseClient } from '@supabase/supabase-js'
import { upcomingWeekStartISO } from '@/lib/dates/week'

export interface ShiftTypeRow {
  id: string
  key: string
  name: string
  start_hour: number
  hours: number
  color: string
  sort: number
}

export interface RequestRow {
  id: string
  day_of_week: number
  is_off: boolean
  preferred_shift_ids: string[]
}

export interface VacationRow {
  id: string
  date_from: string
  date_to: string
}

export interface EmployeeRequestsContext {
  employee: { id: string; name: string; workplace_id: string }
  weekStart: string
  period: { id: string; status: 'collecting' | 'locked' | 'published' } | null
  shiftTypes: ShiftTypeRow[]
  /** Map: day_of_week (0–6) → RequestRow */
  requestsByDay: Record<number, RequestRow>
  vacations: VacationRow[]
  /** ISO timestamp of the employee's latest submission for this period, or null. */
  submittedAt: string | null
}

/**
 * Resolves all data needed to render /me/requests for the authenticated employee.
 * Returns null if the current user has no employee row.
 */
export async function getEmployeeRequestsContext(
  supabase: SupabaseClient,
): Promise<EmployeeRequestsContext | null> {
  const { data: emp } = await supabase
    .from('employees')
    .select('id, name, workplace_id')
    .limit(1)
    .maybeSingle()

  if (!emp) return null

  const weekStart = upcomingWeekStartISO(new Date())

  // Ensure the period exists (RPC creates it if needed) — employees cannot INSERT directly.
  const { data: periodId, error: rpcError } = await supabase.rpc('ensure_upcoming_period', {
    wp: emp.workplace_id,
    wk: weekStart,
  })

  if (rpcError || !periodId) return null

  const [
    { data: periodRow },
    { data: shiftTypesRaw },
    { data: requestsRaw },
    { data: vacationsRaw },
    { data: submissionRow },
  ] = await Promise.all([
    supabase
      .from('schedule_periods')
      .select('id, status')
      .eq('id', periodId)
      .maybeSingle(),
    supabase
      .from('shift_types')
      .select('id, key, name, start_hour, hours, color, sort')
      .eq('workplace_id', emp.workplace_id)
      .eq('is_fallback', false)
      .order('sort'),
    supabase
      .from('requests')
      .select('id, day_of_week, is_off, preferred_shift_ids')
      .eq('period_id', periodId)
      .eq('employee_id', emp.id),
    supabase
      .from('employee_vacations')
      .select('id, date_from, date_to')
      .eq('employee_id', emp.id)
      .order('date_from'),
    supabase
      .from('request_submissions')
      .select('submitted_at')
      .eq('period_id', periodId)
      .eq('employee_id', emp.id)
      .maybeSingle(),
  ])

  const requestsByDay: Record<number, RequestRow> = {}
  for (const r of requestsRaw ?? []) {
    requestsByDay[r.day_of_week] = r as RequestRow
  }

  return {
    employee: emp,
    weekStart,
    period: periodRow as { id: string; status: 'collecting' | 'locked' | 'published' } | null,
    shiftTypes: (shiftTypesRaw ?? []) as ShiftTypeRow[],
    requestsByDay,
    vacations: (vacationsRaw ?? []) as VacationRow[],
    submittedAt: (submissionRow?.submitted_at as string | undefined) ?? null,
  }
}
