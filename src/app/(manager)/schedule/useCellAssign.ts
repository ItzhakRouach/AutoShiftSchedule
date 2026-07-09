'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ShiftId } from '@/lib/domain/constants'
import type { ScheduleView } from '@/lib/schedule/view-data'
import { reverseSwap } from '@/lib/schedule/undo-core'
import type { SlotCtx } from './SwapEditor'
import { assignSlot } from './edit-actions'
import { swapSlots, type SwapCell } from './swap-actions'
import { removeAssignmentById } from './temp-actions'
import { useUndoStack } from './useUndoStack'

export interface AssignToastState { text: string; kind: 'ok' | 'err' }

/**
 * The single in-flight operation, if any: a (day, shift, role) slot for an
 * assign, or an assignment id for a temp-removal.
 */
export type PendingSlot =
  | { day: number; shiftKey: ShiftId; roleId: string; assignmentId?: undefined }
  | { assignmentId: string; day?: undefined; shiftKey?: undefined; roleId?: undefined }

/**
 * Fast manual-assignment interactions that bypass the modal (tap-to-assign,
 * drag-drop, temp remove). Every mutation pushes a reversible entry onto the
 * shared undo/redo stack (`useUndoStack`), so the manager gets multi-step
 * Ctrl+Z / Ctrl+Y instead of a one-shot toast undo.
 */
export function useCellAssign(view: ScheduleView) {
  const router = useRouter()
  const [, start] = useTransition()
  const [heldId, setHeldId] = useState<string | null>(null)
  const [toast, setToast] = useState<AssignToastState | null>(null)
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null)
  const history = useUndoStack(view.periodId, () => setToast(null))

  const dispatch = useCallback(
    (slot: SlotCtx, employeeId: string) => {
      if (pendingSlot) return // double-tap guard: one in-flight dispatch at a time
      setToast(null)
      setPendingSlot({ day: slot.day, shiftKey: slot.shiftKey, roleId: slot.roleId })
      void (async () => {
        try {
          const res = await assignSlot(view.periodId, slot.day, slot.shiftTypeId, slot.roleId, employeeId)
          if (!res.ok) { setToast({ text: res.error ?? 'שגיאה', kind: 'err' }); return }
          if (res.undo) {
            history.push({
              undo: res.undo,
              // Redo re-applies the same assignment via the restore primitive.
              redo: { kind: 'assign', employeeId, day: slot.day, prev: { shiftTypeId: slot.shiftTypeId, roleId: slot.roleId, source: 'manual' } },
              label: 'שיבוץ',
            })
          }
          setToast({ text: 'שובץ ✓', kind: 'ok' })
          start(() => router.refresh())
        } finally {
          setPendingSlot(null)
        }
      })()
    },
    [view.periodId, router, pendingSlot, history],
  )

  const hold = useCallback((id: string) => setHeldId((cur) => (cur === id ? null : id)), [])
  const clearHeld = useCallback(() => setHeldId(null), [])
  const dismissToast = useCallback(() => setToast(null), [])

  /** Remove an ad-hoc temp entry by its assignment id (undoable, not redoable). */
  const removeTemp = useCallback(
    (assignmentId: string) => {
      if (pendingSlot) return
      setToast(null)
      setPendingSlot({ assignmentId })
      void (async () => {
        try {
          const res = await removeAssignmentById(view.periodId, assignmentId)
          if (!res.ok) { setToast({ text: res.error ?? 'שגיאה', kind: 'err' }); return }
          if (res.undo) history.push({ undo: res.undo, redo: null, label: 'הסרת עובד זמני' })
          setToast({ text: 'הוסר ✓', kind: 'ok' })
          start(() => router.refresh())
        } finally {
          setPendingSlot(null)
        }
      })()
    },
    [view.periodId, router, pendingSlot, history],
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

  /** Drag-swap (A↔B) or drag-move (A → empty cell, source vacated). Validated
   *  server-side both ways; one history entry undoes the whole gesture. */
  const swapWith = useCallback(
    (a: SwapCell, target: { day: number; shiftKey: ShiftId; shiftTypeId: string; roleId: string }, b: SwapCell | null) => {
      if (pendingSlot) return
      setToast(null)
      setHeldId(null)
      setPendingSlot({ day: target.day, shiftKey: target.shiftKey, roleId: target.roleId })
      void (async () => {
        try {
          const res = await swapSlots(view.periodId, a, { day: target.day, shiftTypeId: target.shiftTypeId, roleId: target.roleId }, b)
          if (!res.ok) { setToast({ text: res.error ?? 'שגיאה', kind: 'err' }); return }
          if (res.undo && res.undo.kind === 'swap') {
            history.push({ undo: res.undo, redo: reverseSwap(res.undo), label: b ? 'החלפה' : 'העברה' })
          }
          setToast({ text: res.warning ?? (b ? 'הוחלפו ✓' : 'הועבר ✓'), kind: 'ok' })
          start(() => router.refresh())
        } finally {
          setPendingSlot(null)
        }
      })()
    },
    [view.periodId, router, pendingSlot, history],
  )

  return { heldId, toast, pendingSlot, hold, clearHeld, assignTo, dropOn, swapWith, removeTemp, dismissToast, setToast, history }
}

export type CellAssign = ReturnType<typeof useCellAssign>
