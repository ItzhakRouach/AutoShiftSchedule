// Pure splitters + tiny helpers used by getScheduleView. Kept separate from
// view-data.ts to honor the project's ≤200-line rule.
import { formatHebDate } from '@/lib/dates/week'
import type { ShiftId } from '@/lib/domain/constants'
import type { ShiftKey } from '@/lib/scheduling/types'
import type { DayInfo, ViewGrid, ViewTwelve } from './view-data'

const DAY_SHORTS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

/** 7-day DayInfo[] from the week's ISO start date. */
export function buildDayInfos(weekDates: string[]): DayInfo[] {
  return Array.from({ length: 7 }, (_, i) => ({
    index: i,
    short: DAY_SHORTS[i],
    date: formatHebDate(weekDates[i]),
  }))
}

export interface AssignmentRaw {
  employee_id: string
  day_of_week: number
  shift_type_id: string
  role_id: string
}

export interface GridSplit {
  grid: ViewGrid
  twelve: ViewTwelve[]
  /** Per-day list of (employeeId, shiftKey) tuples — any role, any variant. */
  byDay: Map<number, Array<{ employeeId: string; shiftKey: ShiftId }>>
}

const BASE_KEYS = new Set(['morning', 'noon', 'night'])

/**
 * One pass over the assignments query result: builds the base-shift grid, the
 * separate 12h list, and the per-day index used by night-before detection.
 */
export function splitAssignments(
  assigns: AssignmentRaw[],
  idToAnyKey: Record<string, string>,
): GridSplit {
  const grid: ViewGrid = {}
  const twelve: ViewTwelve[] = []
  const byDay = new Map<number, Array<{ employeeId: string; shiftKey: ShiftId }>>()
  for (const a of assigns) {
    const anyKey = idToAnyKey[a.shift_type_id] as ShiftId | undefined
    if (anyKey) {
      let list = byDay.get(a.day_of_week)
      if (!list) { list = []; byDay.set(a.day_of_week, list) }
      list.push({ employeeId: a.employee_id, shiftKey: anyKey })
    }
    if (anyKey && !BASE_KEYS.has(anyKey)) {
      twelve.push({ day: a.day_of_week, variant: anyKey, roleId: a.role_id, employeeId: a.employee_id })
      continue
    }
    if (!anyKey) continue
    const day = (grid[a.day_of_week] ??= {})
    const byShift = (day[anyKey as ShiftKey] ??= {})
    ;(byShift[a.role_id] ??= []).push(a.employee_id)
  }
  return { grid, twelve, byDay }
}
