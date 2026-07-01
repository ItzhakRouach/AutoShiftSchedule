'use client'

import { useEffect, useState } from 'react'
import type { AssignToastState } from './useCellAssign'

interface Props {
  toast: AssignToastState | null
  onDismiss: () => void
}

/** Transient confirmation for fast (drag / tap) assignments. Auto-dismisses;
 *  extends its timer when an undo action is offered, giving the manager time
 *  to react to the בטל button. */
export function AssignToast({ toast, onDismiss }: Props) {
  // Which toast instance's בטל button was already tapped — compared by
  // reference against the current `toast` prop, so a brand-new toast (a new
  // object from useState) is never mistaken for a stale disabled one, with no
  // extra effect needed to "reset" anything.
  const [undoneToast, setUndoneToast] = useState<AssignToastState | null>(null)
  const undoing = toast !== null && undoneToast === toast

  useEffect(() => {
    if (!toast) return
    const ms = toast.onUndo ? 6000 : toast.kind === 'ok' ? 1600 : 3200
    const t = window.setTimeout(onDismiss, ms)
    return () => window.clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null
  const ok = toast.kind === 'ok'

  function handleUndo(e: React.MouseEvent) {
    e.stopPropagation()
    if (undoing || !toast?.onUndo) return
    setUndoneToast(toast)
    toast.onUndo()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      style={{
        position: 'fixed', insetInlineStart: '50%', insetBlockEnd: 24, transform: 'translateX(-50%)',
        zIndex: 50, padding: '10px 18px', borderRadius: 'var(--r-md)', fontSize: 14, fontWeight: 700,
        background: ok ? 'var(--success)' : 'var(--danger)', color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
        direction: 'rtl', maxWidth: '90vw', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <span>{toast.text}</span>
      {toast.onUndo && (
        <button
          type="button"
          onClick={handleUndo}
          disabled={undoing}
          style={{
            background: 'rgba(255,255,255,0.22)', color: '#fff', border: 'none',
            borderRadius: 'var(--r-sm, 6px)', padding: '4px 10px', fontSize: 13, fontWeight: 800,
            cursor: undoing ? 'default' : 'pointer', opacity: undoing ? 0.6 : 1,
          }}
        >
          בטל
        </button>
      )}
    </div>
  )
}
