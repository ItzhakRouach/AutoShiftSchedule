/**
 * Per-employee week balance for the manager's side panel: shift-type counts,
 * how many shifts were worked in each role, and how many of the worker's shift
 * requests the current schedule honors. Pure, no IO, client-safe — it is
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
  /** Days on which the worker asked for at least one specific shift. */
  asked: number
  /** Of those days, how many they were given one of the shifts they asked for. */
  got: number
}

export type BalanceSort = 'total' | 'nights' | 'requests'

export function buildEmpBalance(view: ScheduleView): EmpBalanceRow[] {
  const roleCounts = new Map<string, Record<string, number>>()
  const gotDays = new Map<string, Set<number>>()
  for (const e of view.employees) {
    roleCounts.set(e.id, {})
    gotDays.set(e.id, new Set())
  }
  const bumpRole = (empId: string, roleId: string) => {
    const rc = roleCounts.get(empId)
    if (rc) rc[roleId] = (rc[roleId] ?? 0) + 1
  }
  const markIfRequested = (empId: string, day: number, shiftKey: string) => {
    const shiftTypeId = view.shiftTypeIdByKey[shiftKey]
    if (shiftTypeId && view.requestedSet.has(`${empId}:${day}:${shiftTypeId}`)) gotDays.get(empId)?.add(day)
  }

  for (let day = 0; day < 7; day++) {
    for (const shift of view.shiftKeys) {
      for (const [roleId, empIds] of Object.entries(view.grid[day]?.[shift] ?? {})) {
        for (const id of empIds) {
          bumpRole(id, roleId)
          markIfRequested(id, day, shift)
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
    for (const f of t.fills ?? []) markIfRequested(t.employeeId, t.day, f.shift)
  }

  const asked = new Map<string, number>()
  for (const r of view.requests) {
    if (r.isOff || r.preferredShiftIds.length === 0) continue
    asked.set(r.employeeId, (asked.get(r.employeeId) ?? 0) + 1)
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
