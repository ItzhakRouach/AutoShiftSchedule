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
 * Build the week grid, expanding 12h assignments into every base-shift they fill.
 * A 12h assignment appears in each covered base-shift cell, flagged `is12h: true`.
 * The `requested` flag is true when requestedSet contains the matching key.
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

  // Expand 12h assignments into every base-shift they fill
  for (const t of view.twelve) {
    const fills = TWELVE_HOUR_FILLS[t.variant as TwelveHourKey]
    if (!fills) continue
    // For 12h: check if any covered base shift was requested
    const requested = fills.some((baseShift) => {
      const stId = view.shiftTypeIdByKey[baseShift] ?? ''
      return reqSet.has(`${t.employeeId}:${t.day}:${stId}`)
    })
    for (const baseShift of fills) {
      const d = (grid[t.day] ??= {})
      const s = (d[baseShift] ??= {})
      ;(s[t.roleId] ??= []).push({ employeeId: t.employeeId, is12h: true, requested })
    }
  }

  return grid
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
