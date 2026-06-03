// PURE snapshot building for the day-level 12h pair. NO Supabase/IO — given the
// day's existing rows + the chosen morning/night/noon-to-remove employees, it
// returns (a) the rows to capture pre-pair (for restore on cancel) and (b) the
// role_id to use for each promoted 12h row (the employee's CURRENT base-shift
// role — so a night-מוקדן promoted to a 12h pair stays מוקדן at night).
import type { ShiftId } from '@/lib/domain/constants'

export interface DaySnapshotRow {
  employee_id: string
  shift_type_id: string
  role_id: string
  source: string
}

export interface BuildSnapshotArgs {
  /** ALL assignments on the target day (any role). */
  dayRows: DaySnapshotRow[]
  /** shift_type_id → ShiftId key (base + 12h). */
  keyById: Record<string, ShiftId>
  morningEmployeeId: string
  nightEmployeeId: string
  roleId: string
  /** Employees of the chosen role's צהריים slot that the pair removes. */
  noonToRemove: string[]
  /** Fallback role for the 12h rows when the employee has no existing base row. */
  fallbackRoleId: string
}

export interface SnapshotResult {
  snapshot: DaySnapshotRow[]
  morningRoleId: string
  nightRoleId: string
}

/**
 * Build the snapshot rows + preserved role ids for an apply call. The snapshot
 * captures everything the apply will overwrite or delete so cancel can replay
 * it back: the morning person's current morning row, the night person's current
 * night row, and the freed noon person(s). Deduplicates if the same employee
 * appears in two roles (defensive — unique constraint forbids that).
 */
export function buildPairSnapshot(args: BuildSnapshotArgs): SnapshotResult {
  const {
    dayRows, keyById, morningEmployeeId, nightEmployeeId,
    roleId, noonToRemove, fallbackRoleId,
  } = args

  const morningRow = dayRows.find(
    (r) => r.employee_id === morningEmployeeId && keyById[r.shift_type_id] === 'morning',
  )
  const nightRow = dayRows.find(
    (r) => r.employee_id === nightEmployeeId && keyById[r.shift_type_id] === 'night',
  )

  const snapshot: DaySnapshotRow[] = []
  const seen = new Set<string>()
  const push = (r?: DaySnapshotRow) => {
    if (!r) return
    const k = `${r.employee_id}:${r.shift_type_id}:${r.role_id}`
    if (seen.has(k)) return
    seen.add(k)
    snapshot.push(r)
  }
  push(morningRow)
  push(nightRow)
  for (const noonEmpId of noonToRemove) {
    push(dayRows.find(
      (r) =>
        r.employee_id === noonEmpId &&
        r.role_id === roleId &&
        keyById[r.shift_type_id] === 'noon',
    ))
  }

  return {
    snapshot,
    morningRoleId: morningRow?.role_id ?? fallbackRoleId,
    nightRoleId: nightRow?.role_id ?? fallbackRoleId,
  }
}
