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
import { buildRequestedSet, type ScheduleView, type ViewGrid, type ViewTwelve, type ViewRequest } from './view-data'
import type { ShiftKey } from '@/lib/scheduling/types'

const DAY_SHORTS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
const BASE_KEYS = new Set(['morning', 'noon', 'night'])

export async function getPublishedScheduleView(
  supabase: SupabaseClient,
  workplaceId: string,
): Promise<ScheduleView | null> {
  // Mirror the manager's CURRENT period: take the latest period and show it only
  // when it is published. We must NOT fall back to an older published week —
  // otherwise unpublishing/deleting the current schedule would leave workers
  // looking at a stale previous week. So the worker sees the current schedule
  // only while it's published, and nothing once the manager unpublishes/clears.
  const { data: period } = await supabase
    .from('schedule_periods')
    .select('id, week_start_date, status')
    .eq('workplace_id', workplaceId)
    .order('week_start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
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
    supabase.from('employees').select('id, name, color').eq('workplace_id', workplaceId).order('name'),
    supabase
      .from('assignments')
      .select('employee_id, day_of_week, shift_type_id, role_id')
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
  for (const a of assignsRaw ?? []) {
    const key = idToKey[a.shift_type_id]
    if (!key) continue
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
    employees: (empsRaw ?? []).map((e) => ({ id: e.id, name: e.name, color: e.color })),
    requirements: {},
    grid,
    twelve,
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
