import { describe, it, expect } from 'vitest'
import { planUndo, type UndoSnapshot } from './undo-core'

describe('planUndo', () => {
  it('assign with a prior row → restores the prior row with its original source', () => {
    const snapshot: UndoSnapshot = {
      kind: 'assign',
      employeeId: 'emp-1',
      day: 2,
      prev: { shiftTypeId: 'shift-1', roleId: 'role-1', source: 'auto' },
    }
    const plan = planUndo(snapshot)
    expect(plan).toEqual({
      op: 'restore-emp-day-row',
      employeeId: 'emp-1',
      day: 2,
      shiftTypeId: 'shift-1',
      roleId: 'role-1',
      source: 'auto',
    })
  })

  it('assign with a null prev (cell was empty) → delete the employee/day row', () => {
    const snapshot: UndoSnapshot = {
      kind: 'assign',
      employeeId: 'emp-1',
      day: 3,
      prev: null,
    }
    const plan = planUndo(snapshot)
    expect(plan).toEqual({ op: 'delete-emp-day', employeeId: 'emp-1', day: 3 })
  })

  it('unassign → re-insert the deleted row verbatim (source preserved)', () => {
    const snapshot: UndoSnapshot = {
      kind: 'unassign',
      employeeId: 'emp-2',
      day: 5,
      row: { shiftTypeId: 'shift-2', roleId: 'role-2', source: 'manual' },
    }
    const plan = planUndo(snapshot)
    expect(plan).toEqual({
      op: 'restore-emp-day-row',
      employeeId: 'emp-2',
      day: 5,
      shiftTypeId: 'shift-2',
      roleId: 'role-2',
      source: 'manual',
    })
  })

  it('temp-add → delete the inserted row by id', () => {
    const snapshot: UndoSnapshot = { kind: 'temp-add', assignmentId: 'row-9' }
    const plan = planUndo(snapshot)
    expect(plan).toEqual({ op: 'delete-by-id', assignmentId: 'row-9' })
  })

  it('temp-remove → re-insert the temp row (new id acceptable)', () => {
    const snapshot: UndoSnapshot = {
      kind: 'temp-remove',
      day: 1,
      row: { tempName: 'מחליף חד פעמי', shiftTypeId: 'shift-3', roleId: 'role-3', source: 'manual' },
    }
    const plan = planUndo(snapshot)
    expect(plan).toEqual({
      op: 'reinsert-temp',
      day: 1,
      tempName: 'מחליף חד פעמי',
      shiftTypeId: 'shift-3',
      roleId: 'role-3',
      source: 'manual',
    })
  })

  it('preserves an auto source verbatim through assign-restore (regenerate-preservation semantics)', () => {
    const snapshot: UndoSnapshot = {
      kind: 'assign',
      employeeId: 'emp-4',
      day: 0,
      prev: { shiftTypeId: 'shift-4', roleId: 'role-4', source: 'auto' },
    }
    const plan = planUndo(snapshot)
    expect(plan.op).toBe('restore-emp-day-row')
    if (plan.op === 'restore-emp-day-row') {
      expect(plan.source).toBe('auto')
    }
  })

  it('preserves a fallback_12h source verbatim through unassign-restore', () => {
    const snapshot: UndoSnapshot = {
      kind: 'unassign',
      employeeId: 'emp-5',
      day: 6,
      row: { shiftTypeId: 'shift-5', roleId: 'role-5', source: 'fallback_12h' },
    }
    const plan = planUndo(snapshot)
    expect(plan.op).toBe('restore-emp-day-row')
    if (plan.op === 'restore-emp-day-row') {
      expect(plan.source).toBe('fallback_12h')
    }
  })
})
