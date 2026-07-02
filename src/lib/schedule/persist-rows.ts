// Pure row-building for persisting an EngineResult's assignments to the
// `assignments` table. Extracted out of the `runSchedule` server action so
// the (employee, day) dedupe / 12h-canonicalization / preserved-row-skipping
// logic is unit-testable without Supabase. No I/O — see CLAUDE.md "pure
// scheduling logic" rule.

import type { EngineResult } from '@/lib/scheduling/types'
import { buildEngineTwelveFills, type TwelveFillEntry } from './twelve-fills'

export interface AssignmentInsertRow {
  period_id: string
  employee_id: string
  day_of_week: number
  shift_type_id: string
  role_id: string
  source: string
  /** Real 12h fill plan (see twelve-fills.ts); null for 8h rows and for 12h
   *  rows whose fills couldn't be resolved. */
  twelve_fills?: TwelveFillEntry[] | null
}

export interface PreservedRow {
  employee_id: string
  day_of_week: number
}

export interface BuildAssignmentRowsContext {
  periodId: string
  /** key (base shift key OR 12h variant key) → shift_type_id, for ALL shift
   *  types incl. 12h fallback variants. */
  allKeyToShiftTypeId: Record<string, string>
  /** base-shift key → shift_type_id (8h shifts only). */
  keyToShiftTypeId: Record<string, string>
  /** role NAME → role_id. */
  nameToRoleId: Record<string, string>
  /** Manual/fallback_12h rows already in the DB for this period. Ignored
   *  entirely when `replaceManual` is true. */
  preservedRows: PreservedRow[]
  /** When false (default), rows colliding with a preserved (employee, day)
   *  pair are skipped so manual/12h edits survive a re-run. */
  replaceManual: boolean
}

/**
 * Builds the auto-assignment rows to persist for a schedule run, from a
 * generated `EngineResult`. Behavior:
 *  - Each 12h coverage assignment produces ONE canonical row (source
 *    'auto') keyed by the variant's shift_type_id; the base-shift cells it
 *    covers (flagged `is12h` in `assignmentsByEmployee`) are skipped.
 *  - When `replaceManual` is false, any (employee, day) pair already held by
 *    a preserved manual/12h row is skipped entirely (no auto row emitted).
 *  - Plain 8h assignments map straight to their base shift_type_id/role_id.
 *  - No duplicate (employee, day) rows are ever emitted — first write wins,
 *    matching 12h-then-8h iteration order.
 */
export function buildAssignmentRows(
  result: Pick<EngineResult, 'twelveHourAssignments' | 'assignmentsByEmployee'>,
  ctx: BuildAssignmentRowsContext,
): AssignmentInsertRow[] {
  const { periodId, allKeyToShiftTypeId, keyToShiftTypeId, nameToRoleId, preservedRows, replaceManual } = ctx
  const preservedSet = new Set(preservedRows.map((r) => `${r.employee_id}|${r.day_of_week}`))
  const rows: AssignmentInsertRow[] = []
  const seen = new Set<string>()

  // Auto-assigned 12h coverage: persist ONE canonical row per person/day/variant.
  // The base-shift cells those 12h occupy carry `is12h` and are skipped below.
  for (const t of result.twelveHourAssignments) {
    const dayKey = `${t.employeeId}|${t.day}`
    if (seen.has(dayKey)) continue
    seen.add(dayKey)
    if (!replaceManual && preservedSet.has(dayKey)) continue
    const shiftTypeId = allKeyToShiftTypeId[t.variant]
    // role: the variant fills (possibly two roles); persist the first covered
    // (back-compat with pre-fills consumers of role_id).
    const firstShift = Object.keys(t.rolesByShift)[0] as keyof typeof t.rolesByShift
    const roleId = nameToRoleId[t.rolesByShift[firstShift] as string]
    if (!shiftTypeId || !roleId) continue
    const twelveFills = buildEngineTwelveFills(t.variant, t.rolesByShift, nameToRoleId)
    if (!twelveFills) continue
    rows.push({
      period_id: periodId,
      employee_id: t.employeeId,
      day_of_week: t.day,
      shift_type_id: shiftTypeId,
      role_id: roleId,
      source: 'auto',
      twelve_fills: twelveFills,
    })
  }

  for (const [employeeId, assignments] of Object.entries(result.assignmentsByEmployee)) {
    for (const a of assignments) {
      if (a.is12h) continue // covered by the canonical 12h row above
      const shiftTypeId = keyToShiftTypeId[a.shift]
      const roleId = nameToRoleId[a.roleId]
      if (!shiftTypeId || !roleId) continue
      const dayKey = `${employeeId}|${a.day}`
      if (seen.has(dayKey)) continue
      seen.add(dayKey)
      // Skip slot if the employee already has a preserved manual/12h row that day.
      if (!replaceManual && preservedSet.has(dayKey)) continue
      rows.push({
        period_id: periodId,
        employee_id: employeeId,
        day_of_week: a.day,
        shift_type_id: shiftTypeId,
        role_id: roleId,
        source: 'auto',
        twelve_fills: null,
      })
    }
  }

  return rows
}
