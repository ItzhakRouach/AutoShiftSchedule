import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { upcomingWeekStartISO } from '@/lib/dates/week'
import { checkFeasibility } from '@/lib/scheduling'
import { buildEngineInput } from './build-input'
import { weekDatesFrom } from './map-rows'
import { shiftMetaFromRow, type ShiftDisplay } from '@/lib/domain/meta'
import { buildNightBeforeByDay, toSerializable, type NightBeforeMap } from './night-before'
import { buildDayInfos, splitAssignments } from './view-data-grid'
import { getSignedScheduleImageUrl } from '@/lib/publish/image'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FeasibilityResult, ShiftKey } from '@/lib/scheduling/types'
import type { AbsenceKind } from '@/lib/vacations/kind-meta'

export interface ViewEmployee { id: string; name: string; color: string }
export interface ViewRole { id: string; name: string; color?: string; rank?: number }
export interface DayInfo { index: number; short: string; date: string }
/** assignments[day][shiftKey][roleId] = employeeId[] */
export type ViewGrid = Record<number, Record<string, Record<string, string[]>>>
/** requirements[day][shiftKey][roleId] = count */
export type ViewReq = Record<number, Record<string, Record<string, number>>>

/** A persisted 12h assignment, surfaced separately so it renders distinctly. */
export interface ViewTwelve {
  day: number
  variant: string // ShiftId (12h key)
  roleId: string
  employeeId: string
}

/** An ad-hoc free-text "temp" worker placed in a cell (no roster employee). */
export interface ViewTempEntry {
  day: number
  shiftKey: string // base ShiftKey the temp fills
  roleId: string
  assignmentId: string
  name: string
}

/** One employee's request for a single day. */
export interface ViewRequest {
  employeeId: string
  dayOfWeek: number
  isOff: boolean
  preferredShiftIds: string[]
}

/** A manager-assigned day note (רענון / free text) marking an employee off-shift. */
export interface DayNote {
  employeeId: string
  day: number
  label: string
}

/** One vacation row surfaced to the manager view — inclusive date range. */
export interface ViewVacation {
  employeeId: string
  dateFrom: string
  dateTo: string
  kind: AbsenceKind
}

export interface ScheduleView {
  periodId: string
  status: string
  weekStart: string
  days: DayInfo[]
  shiftKeys: ShiftKey[]
  roles: ViewRole[]
  employees: ViewEmployee[]
  requirements: ViewReq
  grid: ViewGrid
  twelve: ViewTwelve[]
  /** Ad-hoc free-text temp workers placed in cells (no roster employee). */
  temps: ViewTempEntry[]
  /** base shiftKey → shift_type_id (for opening the editor on a base slot). */
  shiftTypeIdByKey: Record<string, string>
  /** base shiftKey → display meta (name/time/color) from the workplace's DB rows. */
  shiftMeta?: Record<string, ShiftDisplay>
  hasAssignments: boolean
  feasibility: FeasibilityResult | null
  /** All employee requests for this period. */
  requests: ViewRequest[]
  /**
   * Set of "employeeId:day:shiftTypeId" keys where the assignment matches a
   * requested shift (is_off=false AND preferred_shift_ids includes the assigned
   * base shift's type id).
   */
  requestedSet: Set<string>
  /** Manager-assigned day notes (רענון / free text) for this period. */
  dayNotes?: DayNote[]
  /** Employee-submitted vacation ranges visible to the manager (RLS-scoped). */
  vacations?: ViewVacation[]
  /** Time-limited signed URL to the period's published schedule PNG. Present
   *  only when status === 'published' AND an image was uploaded. 7-day TTL. */
  imageShareUrl?: string | null
  /**
   * Per day D (0..6), the list of employee IDs whose previous shift extended
   * past midnight of D — i.e. they were physically working overnight when D
   * begins. Used by the day-note UI to warn the manager when labeling someone
   * the day after a night/m12_night/m12_15to3 shift. D=0 (Sunday) consults the
   * prior-week tail to catch Saturday-night → Sunday cases. Optional for
   * legacy callers (published-view, tests) that don't populate it.
   */
  nightBeforeByDay?: NightBeforeMap
}

/**
 * Pure helper — builds a Set of "employeeId:day:shiftTypeId" keys where the
 * employee actively requested that exact shift (is_off=false and the shift id
 * appears in preferred_shift_ids). Exported for unit testing.
 */
export function buildRequestedSet(requests: ViewRequest[]): Set<string> {
  const set = new Set<string>()
  for (const r of requests) {
    if (r.isOff || r.preferredShiftIds.length === 0) continue
    for (const sid of r.preferredShiftIds) {
      set.add(`${r.employeeId}:${r.dayOfWeek}:${sid}`)
    }
  }
  return set
}

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
      .select('id, employee_id, temp_name, day_of_week, shift_type_id, role_id')
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
