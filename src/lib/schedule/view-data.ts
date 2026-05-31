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
  hasAssignments: boolean
  feasibility: FeasibilityResult | null
}

const DAY_SHORTS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

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

  const [{ data: rolesRaw }, { data: empsRaw }, { data: assignsRaw }, { data: reqRaw }] =
    await Promise.all([
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
    ])

  // Grid from persisted assignments
  const grid: ViewGrid = {}
  for (const a of assignsRaw ?? []) {
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
    hasAssignments: (assignsRaw ?? []).length > 0,
    feasibility,
  }
}
