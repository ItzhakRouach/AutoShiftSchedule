'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { UndoSnapshot } from '@/lib/schedule/undo-core'
import { undoEdit } from './undo-actions'

/**
 * One reversible edit. Both directions are plain UndoSnapshots applied through
 * the same `undoEdit` restore primitive: `undo` restores the pre-edit state,
 * `redo` restores the post-edit state. `redo` is null for edits we can't cleanly
 * re-apply (temp add/remove, whose row ids change on restore) — those are
 * undoable but not redoable.
 */
export interface HistoryEntry {
  undo: UndoSnapshot
  redo: UndoSnapshot | null
  label: string
}

export interface UndoStack {
  push: (entry: HistoryEntry) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  busy: boolean
  /** Most-recent-first labels of undoable edits (for the history tooltip). */
  labels: string[]
  error: string | null
  clearError: () => void
}

/** Multi-step undo/redo over manual schedule edits. */
export function useUndoStack(periodId: string, onApplied: () => void): UndoStack {
  const router = useRouter()
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])
  const [busy, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const push = useCallback((entry: HistoryEntry) => {
    setUndoStack((s) => [...s, entry])
    setRedoStack([])
  }, [])

  const apply = useCallback(
    (snap: UndoSnapshot, onOk: () => void) => {
      start(async () => {
        const res = await undoEdit(periodId, snap)
        if (!res.ok) { setError(res.error ?? 'שגיאה בביטול'); return }
        onOk()
        onApplied()
        router.refresh()
      })
    },
    [periodId, router, onApplied],
  )

  const undo = useCallback(() => {
    if (busy || undoStack.length === 0) return
    const entry = undoStack[undoStack.length - 1]
    apply(entry.undo, () => {
      setUndoStack((s) => s.slice(0, -1))
      setRedoStack((r) => (entry.redo ? [...r, entry] : []))
    })
  }, [busy, undoStack, apply])

  const redo = useCallback(() => {
    if (busy || redoStack.length === 0) return
    const entry = redoStack[redoStack.length - 1]
    if (!entry.redo) return
    apply(entry.redo, () => {
      setRedoStack((r) => r.slice(0, -1))
      setUndoStack((s) => [...s, entry])
    })
  }, [busy, redoStack, apply])

  return {
    push, undo, redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    busy,
    labels: [...undoStack].reverse().map((e) => e.label),
    error,
    clearError: () => setError(null),
  }
}
