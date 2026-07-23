import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth/user'
import { deadlineLabel, isRequestLocked } from '@/lib/deadline/compute'
import { resolveCollectionWeek } from './collection-week'

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

export type VacationStatus = 'pending' | 'approved' | 'rejected'
export type VacationKind = 'vacation' | 'miluim' | 'sick'

export interface VacationRow {
  id: string
  date_from: string
  date_to: string
  status: VacationStatus
  kind: VacationKind
}

export interface EmployeeRequestsContext {
  employee: { id: string; name: string; workplace_id: string }
  weekStart: string
  period: { id: string; status: 'collecting' | 'locked' | 'published' } | null
  /** Effective, real-time read-only state (status + deadline), used by the page. */
  isReadOnly: boolean
  shiftTypes: ShiftTypeRow[]
  /** Map: day_of_week (0–6) → RequestRow */
  requestsByDay: Record<number, RequestRow>
  vacations: VacationRow[]
  /** ISO timestamp of the employee's latest submission for this period, or null. */
  submittedAt: string | null
  /** Hebrew label of when the submission window closes, or null if not configured. */
  deadlineLabel: string | null
  /** Workplace cap on off-day requests per week, `null` = no limit. */
  maxOffDaysPerWeek: number | null
  /** How many of the cap the employee has already used this period. */
  currentOffDayCount: number
}

/**
 * Resolves all data needed to render /me/requests for the authenticated employee.
 * Returns null if the current user has no employee row.
 */
export async function getEmployeeRequestsContext(
  supabase: SupabaseClient,
): Promise<EmployeeRequestsContext | null> {
  // Resolve THIS user's own employee row — ALWAYS filter by user_id (identity is
  // never inferred from RLS scoping). Coworker visibility for the schedule now
  // comes via the workplace_roster RPC, not a broad employees policy.
  const user = await getAuthUser(supabase)
  if (!user) return null

  const { data: emp } = await supabase
    .from('employees')
    .select('id, name, workplace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!emp) return null

  const now = new Date()
  // Hide absences whose range has fully passed — a worker reads as available
  // again once their vacation/מילואים ends (mirrors the manager side in
  // vacations/pending.ts). UTC-date slice, matching that call site.
  const todayISO = now.toISOString().slice(0, 10)

  // Resolve the week the employee should collect for (rolls past published/
  // started/deadline-passed weeks). Shared with /me's deadline banner.
  const week = await resolveCollectionWeek(supabase, emp.workplace_id, now)
  if (!week) return null
  const { weekStart, periodId, status, dow, time, tz, maxOffDaysPerWeek } = week

  const [
    { data: shiftTypesRaw },
    { data: requestsRaw },
    { data: vacationsRaw },
    { data: submissionRow },
  ] = await Promise.all([
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
      .select('id, date_from, date_to, status, kind')
      .eq('employee_id', emp.id)
      .gte('date_to', todayISO)
      .order('date_from'),
    supabase
      .from('request_submissions')
      .select('submitted_at')
      .eq('period_id', periodId)
      .eq('employee_id', emp.id)
      .maybeSingle(),
  ])

  const deadline =
    dow != null && time ? deadlineLabel(weekStart, dow, time, tz) : null

  const requestsByDay: Record<number, RequestRow> = {}
  let currentOffDayCount = 0
  for (const r of requestsRaw ?? []) {
    requestsByDay[r.day_of_week] = r as RequestRow
    if (r.is_off) currentOffDayCount += 1
  }

  return {
    employee: emp,
    weekStart,
    period: { id: periodId, status },
    // Real-time lock: honors the deadline the instant it passes, not only after
    // the daily lock job flips the stored status.
    isReadOnly: isRequestLocked(status, weekStart, dow, time, tz, now),
    shiftTypes: (shiftTypesRaw ?? []) as ShiftTypeRow[],
    requestsByDay,
    vacations: (vacationsRaw ?? []) as VacationRow[],
    submittedAt: (submissionRow?.submitted_at as string | undefined) ?? null,
    deadlineLabel: deadline,
    maxOffDaysPerWeek,
    currentOffDayCount,
  }
}
