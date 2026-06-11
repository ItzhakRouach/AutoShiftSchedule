/**
 * Loads the latest PUBLISHED schedule as a ScheduleView for the employee view.
 * Lighter than getScheduleView: no engine input, no requirements/feasibility
 * (employees can't read shift_requirements via RLS). Returns null when there is
 * no published schedule yet.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatHebDate } from '@/lib/dates/week'
import { weekDatesFrom } from './map-rows'
import { shiftMetaFromRow, type ShiftDisplay } from '@/lib/domain/meta'
import { buildRequestedSet, type ScheduleView, type ViewGrid, type ViewTwelve, type ViewTempEntry, type ViewRequest } from './view-data'
import type { ShiftKey } from '@/lib/scheduling/types'

const DAY_SHORTS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
const BASE_KEYS = new Set(['morning', 'noon', 'night'])

/** Published weeks for a workplace (newest first) — for the week navigator. */
export interface PublishedWeek { id: string; weekStart: string; label: string }

export async function listPublishedWeeks(
  supabase: SupabaseClient,
  workplaceId: string,
): Promise<PublishedWeek[]> {
  const { data } = await supabase
    .from('schedule_periods')
    .select('id, week_start_date')
    .eq('workplace_id', workplaceId)
    .eq('status', 'published')
    .order('week_start_date', { ascending: false })
  return (data ?? []).map((p) => {
    const dates = weekDatesFrom(p.week_start_date as string)
    return {
      id: p.id as string,
      weekStart: p.week_start_date as string,
      label: `${formatHebDate(dates[0])} – ${formatHebDate(dates[6])}`,
    }
  })
}

export async function getPublishedScheduleView(
  supabase: SupabaseClient,
  workplaceId: string,
  periodId?: string,
): Promise<ScheduleView | null> {
  // With an explicit periodId (week navigator) load that PUBLISHED week; without
  // one, default to the most recent PUBLISHED week. Either way only published
  // schedules are shown — an unpublished/cleared week never appears.
  const base = supabase
    .from('schedule_periods')
    .select('id, week_start_date, status')
    .eq('workplace_id', workplaceId)
  const { data: period } = periodId
    ? await base.eq('id', periodId).maybeSingle()
    : await base.eq('status', 'published').order('week_start_date', { ascending: false }).limit(1).maybeSingle()
  if (!period || period.status !== 'published') return null

  const [
    { data: rolesRaw },
    { data: empsRaw },
    { data: assignsRaw },
    { data: shiftTypesRaw },
    { data: requestsRaw },
    { data: dayNotesRaw },
  ] = await Promise.all([
    supabase.from('roles').select('id, name, color, rank').eq('workplace_id', workplaceId).eq('is_active', true).order('rank', { ascending: false }),
    // Coworker roster via a SECURITY DEFINER RPC that returns ONLY id/name/color
    // (no phone/observances/shift-bounds) — see migration 20260608000003.
    supabase.rpc('workplace_roster', { wp: workplaceId }),
    supabase
      .from('assignments')
      .select('id, employee_id, temp_name, day_of_week, shift_type_id, role_id')
      .eq('period_id', period.id),
    supabase.from('shift_types').select('id, key, name, color, start_hour, hours').eq('workplace_id', workplaceId),
    supabase
      .from('requests')
      .select('employee_id, day_of_week, is_off, preferred_shift_ids')
      .eq('period_id', period.id),
    supabase
      .from('day_notes')
      .select('employee_id, day_of_week, label')
      .eq('period_id', period.id),
  ])

  const idToKey: Record<string, string> = {}
  const shiftTypeIdByKey: Record<string, string> = {}
  const shiftMeta: Record<string, ShiftDisplay> = {}
  for (const st of shiftTypesRaw ?? []) {
    idToKey[st.id] = st.key
    shiftTypeIdByKey[st.key] = st.id
    shiftMeta[st.key] = shiftMetaFromRow(st)
  }

  const grid: ViewGrid = {}
  const twelve: ViewTwelve[] = []
  const temps: ViewTempEntry[] = []
  for (const a of assignsRaw ?? []) {
    const key = idToKey[a.shift_type_id]
    if (!key) continue
    if (a.temp_name && !a.employee_id) {
      temps.push({ day: a.day_of_week, shiftKey: key, roleId: a.role_id, assignmentId: a.id ?? '', name: a.temp_name })
      continue
    }
    if (!a.employee_id) continue
    if (!BASE_KEYS.has(key)) {
      twelve.push({ day: a.day_of_week, variant: key, roleId: a.role_id, employeeId: a.employee_id })
      continue
    }
    const day = (grid[a.day_of_week] ??= {})
    const byShift = (day[key] ??= {})
    ;(byShift[a.role_id] ??= []).push(a.employee_id)
  }

  const weekDates = weekDatesFrom(period.week_start_date)
  const days = Array.from({ length: 7 }, (_, i) => ({
    index: i,
    short: DAY_SHORTS[i],
    date: formatHebDate(weekDates[i]),
  }))

  const requests: ViewRequest[] = (requestsRaw ?? []).map((r) => ({
    employeeId: r.employee_id,
    dayOfWeek: r.day_of_week,
    isOff: r.is_off,
    preferredShiftIds: r.preferred_shift_ids ?? [],
  }))

  return {
    periodId: period.id,
    status: period.status,
    weekStart: period.week_start_date,
    days,
    shiftKeys: ['morning', 'noon', 'night'] as ShiftKey[],
    roles: (rolesRaw ?? []).map((r) => ({ id: r.id, name: r.name, color: r.color, rank: r.rank ?? 1 })),
    employees: ((empsRaw ?? []) as { id: string; name: string; color: string }[]).map((e) => ({
      id: e.id,
      name: e.name,
      color: e.color,
    })),
    requirements: {},
    grid,
    twelve,
    temps,
    shiftTypeIdByKey,
    shiftMeta,
    hasAssignments: (assignsRaw ?? []).length > 0,
    feasibility: null,
    requests,
    requestedSet: buildRequestedSet(requests),
    dayNotes: (dayNotesRaw ?? []).map((n) => ({
      employeeId: n.employee_id,
      day: n.day_of_week,
      label: n.label,
    })),
  }
}
