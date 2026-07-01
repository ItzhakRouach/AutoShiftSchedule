// PURE planning for single-step undo of manual schedule edits. NO Supabase/IO.
// The server captures a pre-mutation snapshot at edit time; this module maps
// that snapshot to the exact operation needed to restore the prior state.
// Source is always preserved verbatim on restore — an `auto` row restored as
// `auto` keeps regenerate-preservation semantics (see edit-actions.ts).

/** A base-shift assignment row's identity, minus period/employee/day (carried
 *  separately on the snapshot that embeds it). */
export interface RowShape {
  shiftTypeId: string
  roleId: string
  source: string
}

export type UndoSnapshot =
  | { kind: 'assign'; employeeId: string; day: number; prev: RowShape | null }
  | { kind: 'unassign'; employeeId: string; day: number; row: RowShape }
  | { kind: 'temp-add'; assignmentId: string }
  | {
      kind: 'temp-remove'
      day: number
      row: RowShape & { tempName: string }
    }

export type UndoPlan =
  | { op: 'restore-emp-day-row'; employeeId: string; day: number; shiftTypeId: string; roleId: string; source: string }
  | { op: 'delete-emp-day'; employeeId: string; day: number }
  | { op: 'delete-by-id'; assignmentId: string }
  | { op: 'reinsert-temp'; day: number; tempName: string; shiftTypeId: string; roleId: string; source: string }

/** Map a captured pre-edit snapshot to the operation that reverses it. */
export function planUndo(snapshot: UndoSnapshot): UndoPlan {
  switch (snapshot.kind) {
    case 'assign':
      return snapshot.prev
        ? {
            op: 'restore-emp-day-row',
            employeeId: snapshot.employeeId,
            day: snapshot.day,
            shiftTypeId: snapshot.prev.shiftTypeId,
            roleId: snapshot.prev.roleId,
            source: snapshot.prev.source,
          }
        : { op: 'delete-emp-day', employeeId: snapshot.employeeId, day: snapshot.day }
    case 'unassign':
      return {
        op: 'restore-emp-day-row',
        employeeId: snapshot.employeeId,
        day: snapshot.day,
        shiftTypeId: snapshot.row.shiftTypeId,
        roleId: snapshot.row.roleId,
        source: snapshot.row.source,
      }
    case 'temp-add':
      return { op: 'delete-by-id', assignmentId: snapshot.assignmentId }
    case 'temp-remove':
      return {
        op: 'reinsert-temp',
        day: snapshot.day,
        tempName: snapshot.row.tempName,
        shiftTypeId: snapshot.row.shiftTypeId,
        roleId: snapshot.row.roleId,
        source: snapshot.row.source,
      }
  }
}
