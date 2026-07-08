'use client'

import { useEffect } from 'react'
import type { AssignToastState } from './useCellAssign'

interface Props {
  toast: AssignToastState | null
  onDismiss: () => void
}

/** Transient confirmation for fast (drag / tap) assignments. Auto-dismisses.
 *  Undo/redo now lives in the persistent UndoRedoBar, so the toast is just a
 *  brief status message. */
export function AssignToast({ toast, onDismiss }: Props) {
  useEffect(() => {
    if (!toast) return
    const ms = toast.kind === 'ok' ? 1600 : 3200
    const t = window.setTimeout(onDismiss, ms)
    return () => window.clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null
  const ok = toast.kind === 'ok'

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="assign-toast"
      onClick={onDismiss}
      style={{
        position: 'fixed', insetInlineStart: '50%', insetBlockEnd: 24, transform: 'translateX(-50%)',
        zIndex: 50, padding: '10px 18px', borderRadius: 'var(--r-md)', fontSize: 14, fontWeight: 700,
        background: ok ? 'var(--success)' : 'var(--danger)', color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
        direction: 'rtl', maxWidth: '90vw', cursor: 'pointer',
      }}
    >
      {toast.text}
    </div>
  )
}
