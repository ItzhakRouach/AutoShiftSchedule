'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { SlotCtx } from './SwapEditor'
import { assignSlot } from './edit-actions'
import { removeAssignmentById } from './temp-actions'

export interface AssignToastState { text: string; kind: 'ok' | 'err' }

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

  const dispatch = useCallback(
    (slot: SlotCtx, employeeId: string) => {
      setToast(null)
      void (async () => {
        const res = await assignSlot(view.periodId, slot.day, slot.shiftTypeId, slot.roleId, employeeId)
        if (!res.ok) {
          setToast({ text: res.error ?? 'שגיאה', kind: 'err' })
          return
        }
        setToast({ text: 'שובץ ✓', kind: 'ok' })
        start(() => router.refresh())
      })()
    },
    [view.periodId, router],
  )

  const hold = useCallback((id: string) => setHeldId((cur) => (cur === id ? null : id)), [])
  const clearHeld = useCallback(() => setHeldId(null), [])
  const dismissToast = useCallback(() => setToast(null), [])

  /** Remove an ad-hoc temp entry by its assignment id. */
  const removeTemp = useCallback(
    (assignmentId: string) => {
      setToast(null)
      void (async () => {
        const res = await removeAssignmentById(view.periodId, assignmentId)
        if (!res.ok) { setToast({ text: res.error ?? 'שגיאה', kind: 'err' }); return }
        setToast({ text: 'הוסר ✓', kind: 'ok' })
        start(() => router.refresh())
      })()
    },
    [view.periodId, router],
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

  return { heldId, toast, hold, clearHeld, assignTo, dropOn, removeTemp, dismissToast }
}

export type CellAssign = ReturnType<typeof useCellAssign>
