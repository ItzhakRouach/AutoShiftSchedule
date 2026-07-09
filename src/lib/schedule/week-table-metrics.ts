/**
 * Derived week metrics for the schedule table header/footer — split out of
 * week-table-data.ts to keep both files within the ≤200-line budget.
 * Pure — no IO.
 */
import type { ScheduleView } from './view-data'
import { buildWeekGrid } from './week-table-data'
import { coveredByTwelve } from './week-table-twelve'

/** Per-day coverage health for the week-table heatmap: how many required
 *  (shift, role) headcount slots that day are filled (8h + 12h coverage). */
export interface DayHealth {
  /** total required headcount across all shift×role slots that day */
  required: number
  /** filled headcount (capped at required per slot) that day */
  filled: number
  /** filled / required in [0,1]; 1 when nothing is required (nothing to fill) */
  ratio: number
}

/**
 * Per-day fill health for all 7 days, mirroring the WeekTable cell math
 * (`assignedCount = cellEntries.length + coveredCount`, capped at required).
 * Pure — drives the day-header heatmap tint + the live gaps counter.
 */
export function buildDayHealth(view: ScheduleView): DayHealth[] {
  const grid = buildWeekGrid(view)
  const coveredMap = coveredByTwelve(view)
  return Array.from({ length: 7 }, (_, day) => {
    let required = 0
    let filled = 0
    const dayReq = view.requirements[day] ?? {}
    for (const shift of Object.keys(dayReq)) {
      const roleReq = dayReq[shift] ?? {}
      for (const [roleId, reqCount] of Object.entries(roleReq)) {
        if (reqCount <= 0) continue
        const assigned = (grid[day]?.[shift]?.[roleId] ?? []).length + (coveredMap.get(`${day}:${shift}:${roleId}`) ?? 0)
        required += reqCount
        filled += Math.min(assigned, reqCount)
      }
    }
    return { required, filled, ratio: required === 0 ? 1 : filled / required }
  })
}

/**
 * Total scheduled HOURS per employee for the week: 8h per base assignment, 12h
 * per 12h assignment (deduped by day+variant+employee like buildEmpTotals).
 * Drives the totals-bar hour readout.
 */
export function buildEmpHours(view: ScheduleView): Record<string, number> {
  const hours: Record<string, number> = {}
  for (const e of view.employees) hours[e.id] = 0
  for (let day = 0; day < 7; day++) {
    for (const shift of view.shiftKeys) {
      for (const empIds of Object.values(view.grid[day]?.[shift] ?? {})) {
        for (const eid of empIds) if (eid in hours) hours[eid] += 8
      }
    }
  }
  const seen12 = new Set<string>()
  for (const t of view.twelve) {
    const key = `${t.day}:${t.variant}:${t.employeeId}`
    if (seen12.has(key)) continue
    seen12.add(key)
    if (t.employeeId in hours) hours[t.employeeId] += 12
  }
  return hours
}
