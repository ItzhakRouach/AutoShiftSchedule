/**
 * Helpers that transform a ScheduleView into the data shape the WeekTable needs.
 * Pure — no IO, no Supabase. Testable with plain fixtures.
 */
import type { ScheduleView, ViewEmployee } from './view-data'
import { twelveAnchor, twelveCoversOf, coveredByTwelve } from './week-table-twelve'

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
 * Build the week grid. A 12h assignment is shown in ONLY its anchor cell (the
 * first fill window without a base occupant) flagged `is12h: true`, under the
 * ANCHOR FILL's own role — cross-role plans place the chip correctly and two
 * 12h shifts on the same day never stack into one cell. The other fill(s) it
 * covers are left EMPTY (see `coveredByTwelve` in week-table-twelve.ts) so the
 * table reads cleanly — e.g. a 07–19 day shift shows the worker in בוקר and
 * leaves צהריים blank.
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
  // base person — see twelveAnchor), under the ANCHOR FILL's own role.
  for (const t of view.twelve) {
    const anchor = twelveAnchor(view, t)
    if (!anchor) continue
    // COVERS semantics: the ✓ badge lights for any requested window the 12h
    // physically covers (m12_night → noon or night), not just its fill windows.
    const requested = twelveCoversOf(t).some((shift) => {
      const stId = view.shiftTypeIdByKey[shift] ?? ''
      return reqSet.has(`${t.employeeId}:${t.day}:${stId}`)
    })
    const d = (grid[t.day] ??= {})
    const s = (d[anchor.shift] ??= {})
    ;(s[anchor.roleId] ??= []).push({ employeeId: t.employeeId, is12h: true, requested, variant: t.variant })
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

// buildDayHealth / buildEmpHours (header heatmap + hour totals) live in
// week-table-metrics.ts to keep this file within the ≤200-line budget.

export interface CellCapacity {
  /** `"X/Y"` — blank when the slot has no configured requirement. */
  label: string
  status: 'under' | 'full' | 'over' | 'unconfigured'
}

/**
 * Manager-facing capacity readout for a single (day, shift, role) cell.
 * `requiredCount <= 0` means the slot has no staffing target for this day —
 * distinct from `under`, which means a real target isn't met yet. `over`
 * (assigned beyond the requirement) gets its own status so the UI can flag it
 * distinctly from an exactly-full cell, which needs no badge at all.
 */
export function cellCapacity(assignedCount: number, requiredCount: number): CellCapacity {
  if (requiredCount <= 0) return { label: '', status: 'unconfigured' }
  const label = `${assignedCount}/${requiredCount}`
  const status = assignedCount > requiredCount ? 'over' : assignedCount === requiredCount ? 'full' : 'under'
  return { label, status }
}

/**
 * Number of required (day, shift, role) cells still short of their target —
 * i.e. the "לא מאויש" gaps the manager sees. Mirrors WeekTable's per-cell
 * math exactly: `assignedCount = cellEntries.length + coveredCount` (a 12h
 * shift's covered cell counts toward its target without needing a base
 * occupant). Drives the secondary "השלם 12ש׳ אוטומטית" button's visibility.
 */
export function countUncoveredCells(view: ScheduleView): number {
  const grid = buildWeekGrid(view)
  const coveredMap = coveredByTwelve(view)
  let gaps = 0
  for (const dayKey of Object.keys(view.requirements)) {
    const day = Number(dayKey)
    const dayReq = view.requirements[day] ?? {}
    for (const shift of Object.keys(dayReq)) {
      const roleReq = dayReq[shift] ?? {}
      for (const [roleId, requiredCount] of Object.entries(roleReq)) {
        if (requiredCount <= 0) continue
        const cellEntries = grid[day]?.[shift]?.[roleId] ?? []
        const coveredCount = coveredMap.get(`${day}:${shift}:${roleId}`) ?? 0
        const assignedCount = cellEntries.length + coveredCount
        if (assignedCount < requiredCount) gaps++
      }
    }
  }
  return gaps
}
