/**
 * Helpers that transform a ScheduleView into the data shape the WeekTable needs.
 * Pure — no IO, no Supabase. Testable with plain fixtures.
 */
import type { ScheduleView, ViewEmployee, ViewTwelve } from './view-data'
import { TWELVE_HOUR_COVERS, TWELVE_HOUR_FILLS } from '@/lib/scheduling/fallback'
import type { TwelveHourKey } from '@/lib/scheduling/types'

/** Is a base (non-12h) person already assigned to this (day, shift, role)? */
function baseOccupied(view: ScheduleView, day: number, shift: string, roleId: string): boolean {
  return (view.grid[day]?.[shift]?.[roleId] ?? []).length > 0
}

/**
 * Which base-shift cell shows a 12h person's NAME: the first shift it FILLS that
 * isn't already staffed by a base person — i.e. the actual gap it's covering. So
 * a 07–19 day shift covering a noon gap (morning already staffed) shows in
 * צהריים, NOT stacked on top of the morning person. Falls back to fills[0].
 */
function twelveAnchor(view: ScheduleView, t: ViewTwelve): string | undefined {
  const fills = TWELVE_HOUR_FILLS[t.variant as TwelveHourKey]
  if (!fills || fills.length === 0) return undefined
  return fills.find((s) => !baseOccupied(view, t.day, s, t.roleId)) ?? fills[0]
}

export interface CellEntry {
  employeeId: string
  is12h: boolean
  /** True when this assignment matches a shift the employee explicitly requested. */
  requested: boolean
  /** 12h variant key (for the hour-range label), present only when is12h. */
  variant?: string
  /** Set for ad-hoc temp workers (no roster employee); the free-text display name. */
  tempName?: string
  /** Assignment row id — present for temp entries so they can be removed by id. */
  assignmentId?: string
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

  // Place each 12h person's NAME in the gap cell it fills (never stacked onto a
  // base person — see twelveAnchor).
  for (const t of view.twelve) {
    const fills = TWELVE_HOUR_FILLS[t.variant as TwelveHourKey]
    if (!fills || fills.length === 0) continue
    const requested = fills.some((baseShift) => {
      const stId = view.shiftTypeIdByKey[baseShift] ?? ''
      return reqSet.has(`${t.employeeId}:${t.day}:${stId}`)
    })
    const anchor = twelveAnchor(view, t)
    if (!anchor) continue
    const d = (grid[t.day] ??= {})
    const s = (d[anchor] ??= {})
    ;(s[t.roleId] ??= []).push({ employeeId: t.employeeId, is12h: true, requested, variant: t.variant })
  }

  // Ad-hoc temp workers — placed in their exact (day, shift, role) cell. They
  // carry no employeeId; the cell renderer shows `tempName` with a remove (×).
  for (const t of view.temps ?? []) {
    const d = (grid[t.day] ??= {})
    const s = (d[t.shiftKey] ??= {})
    ;(s[t.roleId] ??= []).push({ employeeId: '', is12h: false, requested: false, tempName: t.name, assignmentId: t.assignmentId })
  }

  return grid
}

/**
 * Cells visually marked as covered by a 12h shift — every base-shift the 12h
 * variant PHYSICALLY occupies (TWELVE_HOUR_COVERS) at the 12h person's role,
 * minus the anchor (where the name actually shows). Keys:
 * `${day}:${shiftKey}:${roleId}`. The table renders these as the "12ש׳" chip
 * instead of the red "לא מאויש" — even when the role differs from the wizard's
 * pair role (e.g. a night-מוקדן on m12_night also marks noon-מוקדן as covered,
 * because that person physically holds 19:00–23:00 of the noon window).
 */
export function coveredByTwelve(view: ScheduleView): Set<string> {
  const covered = new Set<string>()
  for (const t of view.twelve) {
    const physical = TWELVE_HOUR_COVERS[t.variant as TwelveHourKey]
    if (!physical || physical.length === 0) continue
    const anchor = twelveAnchor(view, t) // where the NAME shows (the gap it fills)
    for (const baseShift of physical) {
      if (baseShift === anchor) continue
      // A base-staffed cell shows that person — don't overwrite it with "12ש׳".
      if (baseOccupied(view, t.day, baseShift, t.roleId)) continue
      covered.add(`${t.day}:${baseShift}:${t.roleId}`)
    }
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
