/**
 * Pure helper: summarize one employee's published shifts for their personal area.
 * No IO — unit-testable. Counts by role and by shift type, and how many of the
 * employee's requests were honored (same match rule as the manager dashboard).
 */

export interface SummaryAssignment {
  day_of_week: number
  shift_type_id: string
  role_id: string
}

export interface SummaryRequest {
  day_of_week: number
  is_off: boolean
  preferred_shift_ids: string[] | null
}

export interface EmployeeSummary {
  total: number
  byShiftType: Record<string, number>
  byRole: Record<string, number>
  requestedCount: number
  honoredCount: number
}

const SHIFT_LABEL: Record<string, string> = {
  morning: 'בוקר',
  noon: 'צהריים',
  night: 'לילה',
}
const BASE_LABELS = ['בוקר', 'צהריים', 'לילה'] as const

export function summarizeEmployee(
  assignments: SummaryAssignment[],
  requests: SummaryRequest[],
  shiftKeyById: Map<string, string>,
  roleNameById: Map<string, string>,
): EmployeeSummary {
  const byShiftType: Record<string, number> = { בוקר: 0, צהריים: 0, לילה: 0 }
  const byRole: Record<string, number> = {}

  for (const a of assignments) {
    // Only categorize KNOWN shift types: a base key → its label, any other known
    // (12h) key → "12 שעות". An unknown shift_type_id (orphaned/corrupt) is not
    // counted as 12h — it's skipped from the breakdown.
    const key = shiftKeyById.get(a.shift_type_id)
    if (key) {
      const label = SHIFT_LABEL[key] ?? '12 שעות'
      byShiftType[label] = (byShiftType[label] ?? 0) + 1
    }

    const roleName = roleNameById.get(a.role_id)
    if (roleName) byRole[roleName] = (byRole[roleName] ?? 0) + 1
  }

  let requestedCount = 0
  let honoredCount = 0
  for (const r of requests) {
    const hasPref = !!r.preferred_shift_ids && r.preferred_shift_ids.length > 0
    if (!r.is_off && !hasPref) continue // empty (no real ask)
    requestedCount += 1
    // A request may offer alternatives ("morning OR off"). It's honored if the
    // worker got ANY preferred shift, OR (off was acceptable) they didn't work.
    const gotPreferred = hasPref && assignments.some(
      (a) => a.day_of_week === r.day_of_week && r.preferred_shift_ids!.includes(a.shift_type_id),
    )
    const worksThatDay = assignments.some((a) => a.day_of_week === r.day_of_week)
    if (gotPreferred || (r.is_off && !worksThatDay)) honoredCount += 1
  }

  return { total: assignments.length, byShiftType, byRole, requestedCount, honoredCount }
}

/** Stable display order for the base shift-type labels (12h appended if present). */
export function shiftTypeOrder(byShiftType: Record<string, number>): string[] {
  const extras = Object.keys(byShiftType).filter((k) => !BASE_LABELS.includes(k as typeof BASE_LABELS[number]))
  return [...BASE_LABELS, ...extras]
}
