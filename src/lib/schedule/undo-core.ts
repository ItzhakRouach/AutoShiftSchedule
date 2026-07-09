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

/** One participant of a drag-swap/move: their row moved fromDay → toDay. */
export interface SwapSide {
  employeeId: string
  fromDay: number
  /** the row that existed at fromDay BEFORE the swap (restored on undo). */
  fromRow: RowShape
  toDay: number
  /** the row the swap created at toDay. */
  toRow: RowShape
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
  | { kind: 'swap'; a: SwapSide; b: SwapSide | null }

export type UndoPlan =
  | { op: 'restore-emp-day-row'; employeeId: string; day: number; shiftTypeId: string; roleId: string; source: string }
  | { op: 'delete-emp-day'; employeeId: string; day: number }
  | { op: 'delete-by-id'; assignmentId: string }
  | { op: 'reinsert-temp'; day: number; tempName: string; shiftTypeId: string; roleId: string; source: string }
  | { op: 'apply-swap'; a: SwapSide; b: SwapSide | null }

/** A side with direction flipped: applying it moves the row back. */
export function reverseSwapSide(s: SwapSide): SwapSide {
  return { employeeId: s.employeeId, fromDay: s.toDay, fromRow: s.toRow, toDay: s.fromDay, toRow: s.fromRow }
}

/** The swap that exactly reverses `snap` (used both for undo and as the redo
 *  snapshot — reversing twice yields the forward swap again). */
export function reverseSwap(snap: Extract<UndoSnapshot, { kind: 'swap' }>): Extract<UndoSnapshot, { kind: 'swap' }> {
  return { kind: 'swap', a: reverseSwapSide(snap.a), b: snap.b ? reverseSwapSide(snap.b) : null }
}

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
    case 'swap':
      // Undo a swap by applying the reversed exchange (each side moves back to
      // its original cell with its original row, incl. its original source).
      return { op: 'apply-swap', a: reverseSwapSide(snapshot.a), b: snapshot.b ? reverseSwapSide(snapshot.b) : null }
  }
}
