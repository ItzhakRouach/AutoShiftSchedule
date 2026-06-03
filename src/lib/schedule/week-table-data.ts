/**
 * Helpers that transform a ScheduleView into the data shape the WeekTable needs.
 * Pure — no IO, no Supabase. Testable with plain fixtures.
 */
import type { ScheduleView, ViewEmployee } from './view-data'
import { TWELVE_HOUR_FILLS } from '@/lib/scheduling/fallback'
import type { TwelveHourKey } from '@/lib/scheduling/types'

export interface CellEntry {
  employeeId: string
  is12h: boolean
  /** True when this assignment matches a shift the employee explicitly requested. */
  requested: boolean
}

/** weekGrid[day][shiftKey][roleId] = CellEntry[] */
export type WeekGrid = Record<number, Record<string, Record<string, CellEntry[]>>>

/** Per-employee total shifts for the week (each 12h counts as 1 in the cells it covers). */
export type EmpTotals = Record<string, number>

/**
 * Build the week grid. A 12h assignment is shown in ONLY its anchor base-shift
 * cell (the first shift it fills) flagged `is12h: true`; the other in-between
 * shift(s) it covers are left EMPTY (see `coveredByTwelve`) so the table reads
 * cleanly — e.g. a 07–19 day shift shows the worker in בוקר and leaves צהריים blank.
 */
export function buildWeekGrid(view: ScheduleView): WeekGrid {
  const grid: WeekGrid = {}
  const reqSet = view.requestedSet ?? new Set<string>()

  // Seed base assignments
  for (let day = 0; day < 7; day++) {
    for (const shift of view.shiftKeys) {
      const shiftTypeId = view.shiftTypeIdByKey[shift] ?? ''
      const byRole = view.grid[day]?.[shift] ?? {}
      for (const [roleId, empIds] of Object.entries(byRole)) {
        for (const eid of empIds) {
          const d = (grid[day] ??= {})
          const s = (d[shift] ??= {})
          const requested = reqSet.has(`${eid}:${day}:${shiftTypeId}`)
          ;(s[roleId] ??= []).push({ employeeId: eid, is12h: false, requested })
        }
      }
    }
  }

  // Place each 12h person in its ANCHOR cell only (fills[0]).
  for (const t of view.twelve) {
    const fills = TWELVE_HOUR_FILLS[t.variant as TwelveHourKey]
    if (!fills || fills.length === 0) continue
    const requested = fills.some((baseShift) => {
      const stId = view.shiftTypeIdByKey[baseShift] ?? ''
      return reqSet.has(`${t.employeeId}:${t.day}:${stId}`)
    })
    const anchor = fills[0]
    const d = (grid[t.day] ??= {})
    const s = (d[anchor] ??= {})
    ;(s[t.roleId] ??= []).push({ employeeId: t.employeeId, is12h: true, requested })
  }

  return grid
}

/**
 * Cells covered by a 12h shift from an adjacent anchor — the "in-between" shifts
 * (fills[1..]) a 12h assignment spans. Keys: `${day}:${shiftKey}:${roleId}`.
 * The table renders these EMPTY but NOT as gaps (they're staffed by the 12h).
 */
export function coveredByTwelve(view: ScheduleView): Set<string> {
  const covered = new Set<string>()
  for (const t of view.twelve) {
    const fills = TWELVE_HOUR_FILLS[t.variant as TwelveHourKey]
    if (!fills || fills.length <= 1) continue
    for (const baseShift of fills.slice(1)) covered.add(`${t.day}:${baseShift}:${t.roleId}`)
  }
  return covered
}

/**
 * Count total shift-cells per employee across the week.
 * A 12h assignment that covers 2 base-shifts counts once (not twice).
 */
export function buildEmpTotals(view: ScheduleView, employees: ViewEmployee[]): EmpTotals {
  const totals: EmpTotals = {}
  for (const e of employees) totals[e.id] = 0

  // Base assignments (8h)
  for (let day = 0; day < 7; day++) {
    for (const shift of view.shiftKeys) {
      const byRole = view.grid[day]?.[shift] ?? {}
      for (const empIds of Object.values(byRole)) {
        for (const eid of empIds) {
          if (eid in totals) totals[eid]++
        }
      }
    }
  }

  // 12h assignments: count once per (day, variant, employee) triple
  const seen12 = new Set<string>()
  for (const t of view.twelve) {
    const key = `${t.day}:${t.variant}:${t.employeeId}`
    if (seen12.has(key)) continue
    seen12.add(key)
    if (t.employeeId in totals) totals[t.employeeId]++
  }

  return totals
}
