import type { ViewEmployee, ViewRequest, ViewVacation } from '@/lib/schedule/view-data'
import type { WorkplaceVacation } from '@/lib/vacations/pending'

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
  const [y, m, d] = weekStart.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + dayIndex)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
