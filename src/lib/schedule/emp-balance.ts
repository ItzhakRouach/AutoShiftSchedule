/**
 * Per-employee week balance for the manager's side panel: shift-type counts,
 * how many shifts were worked in each role, and how many of the worker's
 * requests (specific shifts and days off) the current schedule honors. Pure, no IO, client-safe — it is
 * recomputed from the view after every edit.
 *
 * Shift-type counts come straight from `buildEmpDistribution`, so the panel can
 * never disagree with the distribution drawer or the totals bar. Role counts
 * walk the same two disjoint sources (base grid, 12h rows) with the same 12h
 * dedup key, which keeps Σ roleCounts === total.
 */
import type { ScheduleView } from './view-data'
import { buildEmpDistribution, type BucketCounts } from './emp-distribution'

export interface EmpBalanceRow {
  employeeId: string
  name: string
  color: string
  counts: BucketCounts
  /** m12_day + m12_night — the panel shows 12h shifts as one column. */
  twelve: number
  total: number
  hours: number
  /** roleId → shifts worked in that role. Roles with zero shifts are absent. */
  roleCounts: Record<string, number>
  /** Days on which the worker asked for something: a specific shift, or the day off. */
  asked: number
  /** Of those days, how many were honored — given one of the shifts they asked
   *  for, or left without any shift on a requested day off. */
  got: number
}

export type BalanceSort = 'total' | 'nights' | 'requests'

export function buildEmpBalance(view: ScheduleView): EmpBalanceRow[] {
  const roleCounts = new Map<string, Record<string, number>>()
  const gotDays = new Map<string, Set<number>>()
  /** emp → day → shift_type_ids worked that day (a 12h lists the windows it fills). */
  const worked = new Map<string, Map<number, Set<string>>>()
  for (const e of view.employees) {
    roleCounts.set(e.id, {})
    gotDays.set(e.id, new Set())
    worked.set(e.id, new Map())
  }
  const bumpRole = (empId: string, roleId: string) => {
    const rc = roleCounts.get(empId)
    if (rc) rc[roleId] = (rc[roleId] ?? 0) + 1
  }
  // Records the shift as worked and, when it is one the worker asked for, the day as honored.
  const recordShift = (empId: string, day: number, shiftKey?: string) => {
    const days = worked.get(empId)
    if (!days) return
    const ids = days.get(day) ?? new Set<string>()
    days.set(day, ids)
    const shiftTypeId = shiftKey ? view.shiftTypeIdByKey[shiftKey] : undefined
    if (!shiftTypeId) return
    ids.add(shiftTypeId)
    if (view.requestedSet.has(`${empId}:${day}:${shiftTypeId}`)) gotDays.get(empId)?.add(day)
  }

  for (let day = 0; day < 7; day++) {
    for (const shift of view.shiftKeys) {
      for (const [roleId, empIds] of Object.entries(view.grid[day]?.[shift] ?? {})) {
        for (const id of empIds) {
          bumpRole(id, roleId)
          recordShift(id, day, shift)
        }
      }
    }
  }

  // One logical 12h shift can surface as several rows under different roles —
  // same dedup key as buildEmpDistribution, counted under the first row's role.
  const seen = new Set<string>()
  for (const t of view.twelve) {
    const key = `${t.day}:${t.variant}:${t.employeeId}`
    if (seen.has(key)) continue
    seen.add(key)
    bumpRole(t.employeeId, t.roleId)
    // A 12h covers the base windows it fills; asking for any of them was honored.
    recordShift(t.employeeId, t.day)
    for (const f of t.fills ?? []) recordShift(t.employeeId, t.day, f.shift)
  }

  // A day-off request is honored when the worker ends up with no shift that
  // day — or, when they also named shifts they would accept on it, with one of those.
  const asked = new Map<string, number>()
  for (const r of view.requests) {
    if (!r.isOff && r.preferredShiftIds.length === 0) continue
    asked.set(r.employeeId, (asked.get(r.employeeId) ?? 0) + 1)
    if (!r.isOff) continue
    const ids = worked.get(r.employeeId)?.get(r.dayOfWeek)
    if (!ids || r.preferredShiftIds.some((id) => ids.has(id))) gotDays.get(r.employeeId)?.add(r.dayOfWeek)
  }

  return buildEmpDistribution(view).rows.map((d) => ({
    employeeId: d.employeeId,
    name: d.name,
    color: d.color,
    counts: d.counts,
    twelve: d.counts.m12_day + d.counts.m12_night,
    total: d.total,
    hours: d.hours,
    roleCounts: roleCounts.get(d.employeeId) ?? {},
    asked: asked.get(d.employeeId) ?? 0,
    got: gotDays.get(d.employeeId)?.size ?? 0,
  }))
}

const nightsOf = (r: EmpBalanceRow) => r.counts.night + r.counts.m12_night
const byName = (a: EmpBalanceRow, b: EmpBalanceRow) => a.name.localeCompare(b.name, 'he')

/** Returns a sorted copy. `requests` puts the least-honored workers first —
 *  they are the ones to fix — and workers who asked for nothing last. */
export function sortBalanceRows(rows: EmpBalanceRow[], mode: BalanceSort): EmpBalanceRow[] {
  const copy = [...rows]
  if (mode === 'nights') return copy.sort((a, b) => nightsOf(b) - nightsOf(a) || b.total - a.total || byName(a, b))
  if (mode === 'requests') {
    const ratio = (r: EmpBalanceRow) => (r.asked === 0 ? 2 : r.got / r.asked)
    return copy.sort((a, b) => ratio(a) - ratio(b) || b.asked - a.asked || byName(a, b))
  }
  return copy.sort((a, b) => b.total - a.total || byName(a, b))
}
