// PURE indexing helpers shared between the request-honored and fairness
// rollups. Building these once turns the per-employee × per-request work in
// `aggregate.ts` from O(R × A) into O(R + A).
import { TWELVE_HOUR_COVERS } from '@/lib/scheduling/fallback'
import type { TwelveHourKey } from '@/lib/scheduling/types'
import type { AssignmentRow } from './aggregate'

/** Base windows a shift KEY physically covers: a base key covers itself; a 12h
 *  variant covers per TWELVE_HOUR_COVERS (m12_night → noon+night). */
export function coveredKeysOf(key: string | undefined | null): string[] {
  if (!key) return []
  const twelve = TWELVE_HOUR_COVERS[key as TwelveHourKey]
  return twelve ? [...twelve] : [key]
}

interface RequestRow {
  employee_id: string
  period_id: string
  day_of_week: number
  is_off: boolean
  preferred_shift_ids: string[] | null
}

/** Per-employee `${day}:${shiftTypeId}` set — O(1) request-honored lookup. */
export type AssignmentIndex = Map<string, Set<string>>

/**
 * Single O(n) pass building per-employee day:shift_type sets. When `keyById`
 * (shift_type_id → key) is provided, a 12h variant row ALSO registers the base
 * shift ids it physically covers — so a requested morning matched by an
 * m12_day (or a requested noon by an m12_night) counts as honored.
 */
export function indexAssignments(
  rows: AssignmentRow[],
  keyById?: Map<string, string>,
): AssignmentIndex {
  const idByKey = keyById ? new Map([...keyById].map(([id, k]) => [k, id])) : null
  const index: AssignmentIndex = new Map()
  for (const a of rows) {
    let perEmp = index.get(a.employee_id)
    if (!perEmp) { perEmp = new Set(); index.set(a.employee_id, perEmp) }
    perEmp.add(`${a.day_of_week}:${a.shift_type_id}`)
    if (keyById && idByKey) {
      const key = keyById.get(a.shift_type_id)
      const covers = key ? TWELVE_HOUR_COVERS[key as TwelveHourKey] : undefined
      if (covers) {
        for (const base of covers) {
          const baseId = idByKey.get(base)
          if (baseId) perEmp.add(`${a.day_of_week}:${baseId}`)
        }
      }
    }
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
  // Got any preferred shift? (covers shift-only and "shift OR off" requests).
  if (perEmp && req.preferred_shift_ids) {
    for (const sid of req.preferred_shift_ids) {
      if (perEmp.has(`${req.day_of_week}:${sid}`)) return true
    }
  }
  // Off acceptable AND not working that day → honored.
  if (req.is_off) {
    if (!perEmp) return true
    for (const k of perEmp) if (k.startsWith(`${req.day_of_week}:`)) return false
    return true
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
