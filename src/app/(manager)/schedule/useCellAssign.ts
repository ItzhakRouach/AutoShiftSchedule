'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ShiftId } from '@/lib/domain/constants'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { UndoSnapshot } from '@/lib/schedule/undo-core'
import type { SlotCtx } from './SwapEditor'
import { assignSlot } from './edit-actions'
import { removeAssignmentById } from './temp-actions'
import { undoEdit } from './undo-actions'

export interface AssignToastState { text: string; kind: 'ok' | 'err'; onUndo?: () => void }

/**
 * The single in-flight operation, if any. A (day, shift, role) slot for an
 * assign/dispatch, or an assignment id for a temp-removal (no slot context
 * available at the TempChip call site).
 */
export type PendingSlot =
  | { day: number; shiftKey: ShiftId; roleId: string; assignmentId?: undefined }
  | { assignmentId: string; day?: undefined; shiftKey?: undefined; roleId?: undefined }

/**
 * Fast manual-assignment interactions that bypass the modal:
 *  - tap a worker in the palette to "hold" them, then tap a cell (worker→cell), and
 *  - drag a worker chip onto a cell (drop→cell).
 * Both resolve through the same `assignSlot` server action as the modal, so the
 * capacity fix + engine validation apply uniformly. A toast confirms the result
 * so an assignment never reads as "nothing happened".
 */
export function useCellAssign(view: ScheduleView) {
  const router = useRouter()
  const [, start] = useTransition()
  const [heldId, setHeldId] = useState<string | null>(null)
  const [toast, setToast] = useState<AssignToastState | null>(null)
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null)

  /** Reverse a prior edit via its snapshot. Reuses the pendingSlot guard (keyed
   *  as a synthetic "undo" slot) so the toast's בטל button can't be double-tapped
   *  while the reversal is in flight. Single-step only — no stack, so once this
   *  runs the toast has nothing left to undo. */
  const runUndo = useCallback(
    (undo: UndoSnapshot) => {
      if (pendingSlot) return
      setPendingSlot({ assignmentId: '__undo__' })
      void (async () => {
        try {
          const res = await undoEdit(view.periodId, undo)
          if (!res.ok) { setToast({ text: res.error ?? 'שגיאה', kind: 'err' }); return }
          setToast({ text: 'בוטל ✓', kind: 'ok' })
          start(() => router.refresh())
        } finally {
          setPendingSlot(null)
        }
      })()
    },
    [view.periodId, router, pendingSlot],
  )

  const dispatch = useCallback(
    (slot: SlotCtx, employeeId: string) => {
      if (pendingSlot) return // double-tap guard: one in-flight dispatch at a time
      setToast(null)
      setPendingSlot({ day: slot.day, shiftKey: slot.shiftKey, roleId: slot.roleId })
      void (async () => {
        try {
          const res = await assignSlot(view.periodId, slot.day, slot.shiftTypeId, slot.roleId, employeeId)
          if (!res.ok) {
            setToast({ text: res.error ?? 'שגיאה', kind: 'err' })
            return
          }
          const undo = res.undo
          setToast({ text: 'שובץ ✓', kind: 'ok', onUndo: undo ? () => runUndo(undo) : undefined })
          start(() => router.refresh())
        } finally {
          setPendingSlot(null)
        }
      })()
    },
    [view.periodId, router, pendingSlot, runUndo],
  )

  const hold = useCallback((id: string) => setHeldId((cur) => (cur === id ? null : id)), [])
  const clearHeld = useCallback(() => setHeldId(null), [])
  const dismissToast = useCallback(() => setToast(null), [])

  /** Remove an ad-hoc temp entry by its assignment id. */
  const removeTemp = useCallback(
    (assignmentId: string) => {
      if (pendingSlot) return // double-tap guard
      setToast(null)
      setPendingSlot({ assignmentId })
      void (async () => {
        try {
          const res = await removeAssignmentById(view.periodId, assignmentId)
          if (!res.ok) { setToast({ text: res.error ?? 'שגיאה', kind: 'err' }); return }
          const undo = res.undo
          setToast({ text: 'הוסר ✓', kind: 'ok', onUndo: undo ? () => runUndo(undo) : undefined })
          start(() => router.refresh())
        } finally {
          setPendingSlot(null)
        }
      })()
    },
    [view.periodId, router, pendingSlot, runUndo],
  )

  /** Tap-on-cell with a held worker → assign. Returns true if it consumed the tap. */
  const assignTo = useCallback(
    (slot: SlotCtx): boolean => {
      if (!heldId) return false
      dispatch(slot, heldId)
      setHeldId(null)
      return true
    },
    [heldId, dispatch],
  )

  /** Worker chip dropped on a cell → assign. */
  const dropOn = useCallback(
    (slot: SlotCtx, employeeId: string) => {
      dispatch(slot, employeeId)
      setHeldId(null)
    },
    [dispatch],
  )

  return { heldId, toast, pendingSlot, hold, clearHeld, assignTo, dropOn, removeTemp, dismissToast, runUndo, setToast }
}

export type CellAssign = ReturnType<typeof useCellAssign>
