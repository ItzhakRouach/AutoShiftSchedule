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

/**
 * Was this request honored? For a preferred-shift request: assigned to ANY of
 * the preferred shifts that day. For an OFF-day request: honored when the
 * employee was NOT assigned any shift that day (they got the day off they asked
 * for). Both count as honored requests.
 */
export function reqIsHonored(
  index: AssignmentIndex,
  empId: string,
  req: { day_of_week: number; is_off?: boolean; preferred_shift_ids: string[] | null },
): boolean {
  const perEmp = index.get(empId)
  if (req.is_off) {
    if (!perEmp) return true // no assignments at all → the day off is honored
    for (const k of perEmp) if (k.startsWith(`${req.day_of_week}:`)) return false
    return true
  }
  if (!perEmp || !req.preferred_shift_ids) return false
  for (const sid of req.preferred_shift_ids) {
    if (perEmp.has(`${req.day_of_week}:${sid}`)) return true
  }
  return false
}

/** Group real requests (off-day OR has-preferences) by employee_id. O(R). An
 *  empty non-off request (no preferences) isn't a real ask, so it's skipped. */
export function groupRequestsByEmployee(requests: RequestRow[]): Map<string, RequestRow[]> {
  const m = new Map<string, RequestRow[]>()
  for (const r of requests) {
    const hasPref = !!r.preferred_shift_ids && r.preferred_shift_ids.length > 0
    if (!r.is_off && !hasPref) continue
    let list = m.get(r.employee_id)
    if (!list) { list = []; m.set(r.employee_id, list) }
    list.push(r)
  }
  return m
}
