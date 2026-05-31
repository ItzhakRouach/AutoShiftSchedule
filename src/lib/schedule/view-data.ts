import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { upcomingWeekStartISO, formatHebDate } from '@/lib/dates/week'
import { checkFeasibility } from '@/lib/scheduling'
import { buildEngineInput } from './build-input'
import { weekDatesFrom } from './map-rows'
import type { FeasibilityResult, ShiftKey } from '@/lib/scheduling/types'

export interface ViewEmployee { id: string; name: string; color: string }
export interface ViewRole { id: string; name: string }
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

/** One employee's request for a single day. */
export interface ViewRequest {
  employeeId: string
  dayOfWeek: number
  isOff: boolean
  preferredShiftIds: string[]
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
  /** base shiftKey → shift_type_id (for opening the editor on a base slot). */
  shiftTypeIdByKey: Record<string, string>
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
}

const DAY_SHORTS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

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

  const baseKeys = new Set(['morning', 'noon', 'night'])
  const idToKey: Record<string, ShiftKey> = {}
  for (const [key, id] of Object.entries(built.keyToShiftTypeId)) idToKey[id] = key as ShiftKey

  const [
    { data: rolesRaw },
    { data: empsRaw },
    { data: assignsRaw },
    { data: reqRaw },
    { data: allShiftTypes },
    { data: requestsRaw },
  ] = await Promise.all([
    supabase.from('roles').select('id, name').eq('workplace_id', workplaceId).order('name'),
    supabase.from('employees').select('id, name, color').eq('workplace_id', workplaceId).order('name'),
    supabase
      .from('assignments')
      .select('employee_id, day_of_week, shift_type_id, role_id')
      .eq('period_id', periodId),
    supabase
      .from('shift_requirements')
      .select('day_of_week, shift_type_id, role_id, count')
      .eq('workplace_id', workplaceId),
    supabase.from('shift_types').select('id, key').eq('workplace_id', workplaceId),
    supabase
      .from('requests')
      .select('employee_id, day_of_week, is_off, preferred_shift_ids')
      .eq('period_id', periodId),
  ])

  // All shift-type keys (base + 12h) so manual 12h assignments can be surfaced.
  const idToAnyKey: Record<string, string> = {}
  const shiftTypeIdByKey: Record<string, string> = {}
  for (const st of allShiftTypes ?? []) {
    idToAnyKey[st.id] = st.key
    shiftTypeIdByKey[st.key] = st.id
  }

  // Grid (base shifts) + separate 12h list from persisted assignments.
  const grid: ViewGrid = {}
  const twelve: ViewTwelve[] = []
  for (const a of assignsRaw ?? []) {
    const anyKey = idToAnyKey[a.shift_type_id]
    if (anyKey && !baseKeys.has(anyKey)) {
      twelve.push({ day: a.day_of_week, variant: anyKey, roleId: a.role_id, employeeId: a.employee_id })
      continue
    }
    const key = idToKey[a.shift_type_id]
    if (!key) continue
    const day = (grid[a.day_of_week] ??= {})
    const byShift = (day[key] ??= {})
    ;(byShift[a.role_id] ??= []).push(a.employee_id)
  }

  // Requirements keyed by role UUID (view uses UUIDs; engine input uses names).
  const requirements: ViewReq = {}
  for (const r of reqRaw ?? []) {
    const key = idToKey[r.shift_type_id]
    if (!key) continue
    const day = (requirements[r.day_of_week] ??= {})
    const byShift = (day[key] ??= {})
    byShift[r.role_id] = (byShift[r.role_id] ?? 0) + r.count
  }

  const weekDates = weekDatesFrom(weekStart)
  const days: DayInfo[] = Array.from({ length: 7 }, (_, i) => ({
    index: i,
    short: DAY_SHORTS[i],
    date: formatHebDate(weekDates[i]),
  }))

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

  return {
    periodId,
    status: built.period.status,
    weekStart,
    days,
    shiftKeys: ['morning', 'noon', 'night'],
    roles: (rolesRaw ?? []).map((r) => ({ id: r.id, name: r.name })),
    employees: (empsRaw ?? []).map((e) => ({ id: e.id, name: e.name, color: e.color })),
    requirements,
    grid,
    twelve,
    shiftTypeIdByKey,
    hasAssignments: (assignsRaw ?? []).length > 0,
    feasibility,
    requests,
    requestedSet,
  }
}
