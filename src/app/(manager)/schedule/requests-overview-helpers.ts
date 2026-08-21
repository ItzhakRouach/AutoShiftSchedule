import type { ViewEmployee, ViewRequest, ViewVacation } from '@/lib/schedule/view-data'
import type { WorkplaceVacation } from '@/lib/vacations/pending'
import { addDaysISO } from '@/lib/dates/week'

/** Build a lookup: employeeId → dayOfWeek → ViewRequest */
export function buildRequestMap(
  requests: ViewRequest[],
): Map<string, Map<number, ViewRequest>> {
  const map = new Map<string, Map<number, ViewRequest>>()
  for (const r of requests) {
    let byDay = map.get(r.employeeId)
    if (!byDay) { byDay = new Map(); map.set(r.employeeId, byDay) }
    byDay.set(r.dayOfWeek, r)
  }
  return map
}

/** Employees that have at least one request row. */
export function submittedCount(employees: ViewEmployee[], reqMap: Map<string, Map<number, ViewRequest>>): number {
  return employees.filter((e) => (reqMap.get(e.id)?.size ?? 0) > 0).length
}

export function buildVacationsByEmployee(vacations: ViewVacation[]): Map<string, ViewVacation[]> {
  const m = new Map<string, ViewVacation[]>()
  for (const v of vacations) {
    let list = m.get(v.employeeId)
    if (!list) { list = []; m.set(v.employeeId, list) }
    list.push(v)
  }
  return m
}

/** Groups the richer (any-status/kind) workplace vacations by employee, for
 *  the per-worker vacation sheet's existing-entries list. */
export function buildWorkerVacationsByEmployee(vacations: WorkplaceVacation[]): Map<string, WorkplaceVacation[]> {
  const m = new Map<string, WorkplaceVacation[]>()
  for (const v of vacations) {
    let list = m.get(v.employeeId)
    if (!list) { list = []; m.set(v.employeeId, list) }
    list.push(v)
  }
  return m
}

/** ISO date for current-week day index 0..6 (Sunday..Saturday). */
export function isoForDayIndex(weekStart: string, dayIndex: number): string {
  return addDaysISO(weekStart, dayIndex)
}

/** Kind for the row's name-cell badge: only ranges that overlap the displayed
 *  week count (inclusive bounds, matching employee_vacations semantics); the
 *  earliest dateFrom wins when several kinds overlap — deterministic. */
export function primaryWeekKind(
  empVacs: ViewVacation[],
  weekStartISO: string,
  weekEndISO: string,
): ViewVacation['kind'] | null {
  const overlapping = empVacs.filter((v) => v.dateFrom <= weekEndISO && v.dateTo >= weekStartISO)
  if (overlapping.length === 0) return null
  const sorted = [...overlapping].sort((a, b) => (a.dateFrom < b.dateFrom ? -1 : a.dateFrom > b.dateFrom ? 1 : 0))
  return sorted[0].kind
}
