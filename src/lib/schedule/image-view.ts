/**
 * Loads a ScheduleView for the schedule PNG. Shared by the authed preview
 * route and the publish/cron upload path, so both render identical pixels.
 *
 * Called with the ADMIN client strictly AFTER the caller has authorized access
 * (route.tsx keeps its RLS period fetch + F-17 owner gate for drafts) — the
 * admin read guarantees the image content doesn't vary with the viewer's RLS
 * scope (an employee's client can't read shift_requirements, which would
 * silently change the rendered role rows).
 *
 * Unlike published-view.ts this accepts ANY period status (owner draft
 * preview) and includes requirements (role-row filter). Requests are NOT
 * loaded — the shared image intentionally omits ✓ requested badges.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { shiftMetaFromRow, type ShiftDisplay } from '@/lib/domain/meta'
import type { ShiftKey } from '@/lib/scheduling/types'
import type { ScheduleView, ViewReq } from './view-types'
import { buildDayInfos, splitAssignments } from './view-data-grid'
import { weekDatesFrom } from './map-rows'

export interface PeriodRow {
  id: string
  week_start_date: string
  workplace_id: string
  status: string
}

export interface ScheduleImageView {
  view: ScheduleView
  workplaceName: string
}

export async function getScheduleImageView(
  admin: SupabaseClient,
  period: PeriodRow,
): Promise<ScheduleImageView> {
  const [
    { data: wpRow },
    { data: rolesRaw },
    { data: empsRaw },
    { data: assignsRaw },
    { data: shiftTypesRaw },
    { data: reqRaw },
  ] = await Promise.all([
    admin.from('workplaces').select('name').eq('id', period.workplace_id).maybeSingle(),
    admin
      .from('roles')
      .select('id, name, color, rank')
      .eq('workplace_id', period.workplace_id)
      .eq('is_active', true)
      .order('rank', { ascending: false }),
    admin.from('employees').select('id, name, color').eq('workplace_id', period.workplace_id),
    admin
      .from('assignments')
      .select('id, employee_id, temp_name, day_of_week, shift_type_id, role_id, twelve_fills')
      .eq('period_id', period.id),
    admin
      .from('shift_types')
      .select('id, key, name, color, start_hour, hours')
      .eq('workplace_id', period.workplace_id),
    admin
      .from('shift_requirements')
      .select('day_of_week, shift_type_id, role_id, count')
      .eq('workplace_id', period.workplace_id),
  ])

  const idToKey: Record<string, string> = {}
  const shiftTypeIdByKey: Record<string, string> = {}
  const shiftMeta: Record<string, ShiftDisplay> = {}
  for (const st of shiftTypesRaw ?? []) {
    idToKey[st.id] = st.key
    shiftTypeIdByKey[st.key] = st.id
    shiftMeta[st.key] = shiftMetaFromRow(st)
  }

  const { grid, twelve, temps } = splitAssignments(assignsRaw ?? [], idToKey)

  const requirements: ViewReq = {}
  for (const r of reqRaw ?? []) {
    const key = idToKey[r.shift_type_id]
    if (!key) continue
    const day = (requirements[r.day_of_week] ??= {})
    const byShift = (day[key] ??= {})
    byShift[r.role_id] = (byShift[r.role_id] ?? 0) + r.count
  }

  const view: ScheduleView = {
    periodId: period.id,
    status: period.status,
    weekStart: period.week_start_date,
    days: buildDayInfos(weekDatesFrom(period.week_start_date)),
    shiftKeys: ['morning', 'noon', 'night'] as ShiftKey[],
    roles: (rolesRaw ?? []).map((r) => ({ id: r.id, name: r.name, color: r.color, rank: r.rank ?? 1 })),
    employees: (empsRaw ?? []).map((e) => ({ id: e.id, name: e.name, color: e.color })),
    requirements,
    grid,
    twelve,
    temps,
    shiftTypeIdByKey,
    shiftMeta,
    hasAssignments: (assignsRaw ?? []).length > 0,
    feasibility: null,
    requests: [],
    requestedSet: new Set(),
  }

  return { view, workplaceName: wpRow?.name ?? 'סידור שבועי' }
}
