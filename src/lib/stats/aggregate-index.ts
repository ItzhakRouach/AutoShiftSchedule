// PURE indexing helpers shared between the request-honored and fairness
// rollups. Building these once turns the per-employee × per-request work in
// `aggregate.ts` from O(R × A) into O(R + A).
import type { AssignmentRow } from './aggregate'

interface RequestRow {
  employee_id: string
  period_id: string
  day_of_week: number
  is_off: boolean
  preferred_shift_ids: string[] | null
}

/** Per-employee `${day}:${shiftTypeId}` set — O(1) request-honored lookup. */
export type AssignmentIndex = Map<string, Set<string>>

/** Single O(n) pass building per-employee day:shift_type sets. */
export function indexAssignments(rows: AssignmentRow[]): AssignmentIndex {
  const index: AssignmentIndex = new Map()
  for (const a of rows) {
    let perEmp = index.get(a.employee_id)
    if (!perEmp) { perEmp = new Set(); index.set(a.employee_id, perEmp) }
    perEmp.add(`${a.day_of_week}:${a.shift_type_id}`)
  }
  return index
}

/** True if `emp` was assigned to ANY of `req`'s preferred shifts that day. */
export function reqIsHonored(
  index: AssignmentIndex,
  empId: string,
  req: { day_of_week: number; preferred_shift_ids: string[] | null },
): boolean {
  const perEmp = index.get(empId)
  if (!perEmp || !req.preferred_shift_ids) return false
  for (const sid of req.preferred_shift_ids) {
    if (perEmp.has(`${req.day_of_week}:${sid}`)) return true
  }
  return false
}

/** Group non-off, has-preferences requests by employee_id. O(R). */
export function groupRequestsByEmployee(requests: RequestRow[]): Map<string, RequestRow[]> {
  const m = new Map<string, RequestRow[]>()
  for (const r of requests) {
    if (r.is_off) continue
    if (!r.preferred_shift_ids || r.preferred_shift_ids.length === 0) continue
    let list = m.get(r.employee_id)
    if (!list) { list = []; m.set(r.employee_id, list) }
    list.push(r)
  }
  return m
}
