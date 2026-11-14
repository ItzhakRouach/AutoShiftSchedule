// Per-request deduplicated Supabase reads (React.cache). The /schedule page
// used to fetch the same tables 2–4× per load (view-data + buildEngineInput +
// edit-meta all loading employees/shift_types/roles/requests/...). Each fetcher
// here selects the UNION of the columns its consumers need and is keyed by
// (client, workplaceId|periodId) — callers within one request share one query.
// NOTE: dedupe works when callers pass the SAME client instance (the page
// creates one and threads it down); a different instance just skips the cache.
import 'server-only'
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDaysISO, todayInIsraelISO } from '@/lib/dates/week'

export const ensureUpcomingPeriodId = cache(
  async (sb: SupabaseClient, workplaceId: string, weekStart: string): Promise<string | null> => {
    const { data, error } = await sb.rpc('ensure_upcoming_period', { wp: workplaceId, wk: weekStart })
    return error ? null : ((data as string | null) ?? null)
  },
)

export const fetchShiftTypes = cache(async (sb: SupabaseClient, workplaceId: string) => {
  const { data } = await sb
    .from('shift_types')
    .select('id, key, name, color, start_hour, hours, is_fallback')
    .eq('workplace_id', workplaceId)
  return data ?? []
})

/** ALL roles incl. inactive (rank-desc) — callers filter `is_active` as needed. */
export const fetchRolesAll = cache(async (sb: SupabaseClient, workplaceId: string) => {
  const { data } = await sb
    .from('roles')
    .select('id, name, color, rank, is_active')
    .eq('workplace_id', workplaceId)
    .order('rank', { ascending: false })
  return data ?? []
})

export const fetchEmployeesFull = cache(async (sb: SupabaseClient, workplaceId: string) => {
  const { data } = await sb
    .from('employees')
    .select('id, name, color, employment_type, min_shifts_per_week, max_shifts_per_week, observes_shabbat, observes_holidays, must_accept')
    .eq('workplace_id', workplaceId)
    .order('name')
  return data ?? []
})

export const fetchRequests = cache(async (sb: SupabaseClient, periodId: string) => {
  const { data } = await sb
    .from('requests')
    .select('employee_id, day_of_week, is_off, preferred_shift_ids')
    .eq('period_id', periodId)
  return data ?? []
})

export const fetchAssignmentRows = cache(async (sb: SupabaseClient, periodId: string) => {
  const { data } = await sb
    .from('assignments')
    .select('id, employee_id, temp_name, day_of_week, shift_type_id, role_id, source, twelve_fills')
    .eq('period_id', periodId)
  return data ?? []
})

export const fetchSettings = cache(async (sb: SupabaseClient, workplaceId: string) => {
  const { data } = await sb
    .from('workplace_settings')
    .select('min_rest_hours, ideal_rest_hours, allow_12h_fallback')
    .eq('workplace_id', workplaceId)
    .maybeSingle()
  return data
})

/** How far back an approved absence can end and still matter to a week the
 *  manager can open in the editor (the editor never opens a week that ended). */
const VACATION_LOOKBACK_DAYS = 60

/**
 * Approved absence ranges for this workplace's roster that have not long ended.
 * Filtered by the roster's employee ids so Postgres uses the employee index
 * instead of running the RLS ownership check over every tenant's rows, and
 * bounded in time so the result does not grow with the workplace's history.
 */
export const fetchApprovedVacations = cache(async (sb: SupabaseClient, workplaceId: string) => {
  const ids = (await fetchEmployeesFull(sb, workplaceId)).map((e) => e.id as string)
  if (ids.length === 0) return []
  const { data } = await sb
    .from('employee_vacations')
    .select('employee_id, date_from, date_to, kind')
    .eq('status', 'approved')
    .in('employee_id', ids)
    .gte('date_to', addDaysISO(todayInIsraelISO(), -VACATION_LOOKBACK_DAYS))
  return data ?? []
})

/** Weekly staffing requirements (week-shaped, keyed by workplace). */
export const fetchRequirements = cache(async (sb: SupabaseClient, workplaceId: string) => {
  const { data } = await sb
    .from('shift_requirements')
    .select('day_of_week, shift_type_id, role_id, count')
    .eq('workplace_id', workplaceId)
  return data ?? []
})

/** Manager day notes (רענון / free text) for one period. */
export const fetchDayNotes = cache(async (sb: SupabaseClient, periodId: string) => {
  const { data } = await sb
    .from('day_notes')
    .select('employee_id, day_of_week, label')
    .eq('period_id', periodId)
  return data ?? []
})

/** employee_roles WITH per-role seniority (falls back to the seniority-free
 *  select on older DBs — mirrors fetch-stages' fetchEmployeeRoles). */
export const fetchEmployeeRoles = cache(
  async (sb: SupabaseClient, workplaceId: string): Promise<{ employee_id: string; role_id: string; is_senior?: boolean }[]> => {
    const emps = await fetchEmployeesFull(sb, workplaceId)
    const ids = emps.map((e) => e.id as string)
    if (ids.length === 0) return []
    const withSenior = await sb.from('employee_roles').select('employee_id, role_id, is_senior').in('employee_id', ids)
    if (!withSenior.error) return withSenior.data ?? []
    const base = await sb.from('employee_roles').select('employee_id, role_id').in('employee_id', ids)
    return base.data ?? []
  },
)

export const fetchAvailability = cache(async (sb: SupabaseClient, workplaceId: string) => {
  const emps = await fetchEmployeesFull(sb, workplaceId)
  const ids = emps.map((e) => e.id as string)
  if (ids.length === 0) return []
  const { data } = await sb
    .from('employee_availability')
    .select('employee_id, day_of_week, shift_type_id')
    .in('employee_id', ids)
  return data ?? []
})
