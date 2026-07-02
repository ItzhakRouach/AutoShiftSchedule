import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { upcomingWeekStartISO } from '@/lib/dates/week'
import { checkFeasibility } from '@/lib/scheduling'
import { buildEngineInput } from './build-input'
import { weekDatesFrom } from './map-rows'
import { shiftMetaFromRow, type ShiftDisplay } from '@/lib/domain/meta'
import { buildNightBeforeByDay, toSerializable } from './night-before'
import { buildDayInfos, splitAssignments } from './view-data-grid'
import { getSignedScheduleImageUrl } from '@/lib/publish/image'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FeasibilityResult, ShiftKey } from '@/lib/scheduling/types'
import type { AbsenceKind } from '@/lib/vacations/kind-meta'
import { buildRequestedSet, type ScheduleView, type ViewReq, type ViewRequest } from './view-types'

export * from './view-types'

/** Resolves all data for /schedule. Returns null on missing workplace/period. */
export async function getScheduleView(
  supabase: SupabaseClient,
  workplaceId: string,
): Promise<ScheduleView | null> {
  const weekStart = upcomingWeekStartISO(new Date())
  const { data: periodId, error: rpcError } = await supabase.rpc('ensure_upcoming_period', {
    wp: workplaceId,
    wk: weekStart,
  })
  if (rpcError || !periodId) return null

  const built = await buildEngineInput(supabase, periodId)
  if (!built) return null

  const idToKey: Record<string, ShiftKey> = {}
  for (const [key, id] of Object.entries(built.keyToShiftTypeId)) idToKey[id] = key as ShiftKey

  const [
    { data: rolesRaw },
    { data: empsRaw },
    { data: assignsRaw },
    { data: reqRaw },
    { data: allShiftTypes },
    { data: requestsRaw },
    { data: dayNotesRaw },
    { data: vacationsRaw },
  ] = await Promise.all([
    supabase.from('roles').select('id, name, color, rank').eq('workplace_id', workplaceId).eq('is_active', true).order('rank', { ascending: false }),
    supabase.from('employees').select('id, name, color').eq('workplace_id', workplaceId).order('name'),
    supabase
      .from('assignments')
      .select('id, employee_id, temp_name, day_of_week, shift_type_id, role_id, twelve_fills')
      .eq('period_id', periodId),
    supabase
      .from('shift_requirements')
      .select('day_of_week, shift_type_id, role_id, count')
      .eq('workplace_id', workplaceId),
    supabase.from('shift_types').select('id, key, name, color, start_hour, hours').eq('workplace_id', workplaceId),
    supabase
      .from('requests')
      .select('employee_id, day_of_week, is_off, preferred_shift_ids')
      .eq('period_id', periodId),
    supabase
      .from('day_notes')
      .select('employee_id, day_of_week, label')
      .eq('period_id', periodId),
    // RLS (vacations_manager_select / owns_employee) scopes this to employees
    // owned by the manager — no explicit workplace filter needed.
    supabase
      .from('employee_vacations')
      .select('employee_id, date_from, date_to, kind')
      .eq('status', 'approved'), // only APPROVED vacations count (match the engine)
  ])

  // All shift-type keys (base + 12h) so manual 12h assignments can be surfaced.
  const idToAnyKey: Record<string, string> = {}
  const shiftTypeIdByKey: Record<string, string> = {}
  const shiftMeta: Record<string, ShiftDisplay> = {}
  for (const st of allShiftTypes ?? []) {
    idToAnyKey[st.id] = st.key
    shiftTypeIdByKey[st.key] = st.id
    shiftMeta[st.key] = shiftMetaFromRow(st)
  }

  // Grid (base shifts) + separate 12h list + temp list + per-day index (one pass).
  const { grid, twelve, temps, byDay } = splitAssignments(assignsRaw ?? [], idToAnyKey)

  // Requirements keyed by role UUID (view uses UUIDs; engine input uses names).
  const requirements: ViewReq = {}
  for (const r of reqRaw ?? []) {
    const key = idToKey[r.shift_type_id]
    if (!key) continue
    const day = (requirements[r.day_of_week] ??= {})
    const byShift = (day[key] ??= {})
    byShift[r.role_id] = (byShift[r.role_id] ?? 0) + r.count
  }

  const days = buildDayInfos(weekDatesFrom(weekStart))

  let feasibility: FeasibilityResult | null = null
  try {
    feasibility = checkFeasibility(built.input)
  } catch {
    feasibility = null
  }

  // Build requests list + requestedSet for "ביקש" badge.
  const requests: ViewRequest[] = (requestsRaw ?? []).map((r) => ({
    employeeId: r.employee_id,
    dayOfWeek: r.day_of_week,
    isOff: r.is_off,
    preferredShiftIds: r.preferred_shift_ids ?? [],
  }))

  const requestedSet = buildRequestedSet(requests)

  const nightBeforeByDay = toSerializable(
    buildNightBeforeByDay({ byDay, priorWeekTail: built.input.priorWeekTail ?? {} }),
  )

  // Fetch the signed share URL only when the period is published — saves a
  // round-trip on draft/collecting/locked views and avoids surfacing share UI
  // before the schedule is finalized. Uses the service-role admin client
  // because the storage policy is workplace-scoped; the upstream
  // getActiveWorkplace check already proved the caller has access.
  let imageShareUrl: string | null = null
  if (built.period.status === 'published') {
    imageShareUrl = await getSignedScheduleImageUrl(createAdminClient(), workplaceId, periodId)
  }

  return {
    periodId,
    status: built.period.status,
    weekStart,
    days,
    shiftKeys: ['morning', 'noon', 'night'],
    roles: (rolesRaw ?? []).map((r) => ({ id: r.id, name: r.name, color: r.color, rank: r.rank ?? 1 })),
    employees: (empsRaw ?? []).map((e) => ({ id: e.id, name: e.name, color: e.color })),
    requirements,
    grid,
    twelve,
    temps,
    shiftTypeIdByKey,
    shiftMeta,
    hasAssignments: (assignsRaw ?? []).length > 0,
    feasibility,
    requests,
    requestedSet,
    dayNotes: (dayNotesRaw ?? []).map((n) => ({
      employeeId: n.employee_id,
      day: n.day_of_week,
      label: n.label,
    })),
    vacations: (vacationsRaw ?? []).map((v) => ({
      employeeId: v.employee_id,
      dateFrom: v.date_from,
      dateTo: v.date_to,
      kind: (v.kind as AbsenceKind | null) ?? 'vacation',
    })),
    imageShareUrl,
    nightBeforeByDay,
  }
}
