'use client'

import { useEffect } from 'react'
import { Icon } from '@/components/ui/Icon'
import type { UndoStack } from './useUndoStack'

/** Persistent undo / redo controls for manual schedule edits, with Ctrl/Cmd+Z
 *  and Ctrl/Cmd+Shift+Z (or Ctrl+Y) shortcuts and a recent-edits count. */
export function UndoRedoBar({ history }: { history: UndoStack }) {
  const { undo, redo, canUndo, canRedo, busy, labels } = history

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const btn = (enabled: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 'var(--r-pill)',
    border: '1px solid var(--border)', background: 'var(--surface)', fontFamily: 'var(--font)',
    fontSize: 12.5, fontWeight: 700, color: enabled ? 'var(--text)' : 'var(--text-3)',
    cursor: enabled ? 'pointer' : 'default', opacity: enabled && !busy ? 1 : 0.5,
  })

  if (!canUndo && !canRedo) return null
  return (
    <div style={{ direction: 'rtl', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <button type="button" onClick={undo} disabled={!canUndo || busy} style={btn(canUndo)}
        title={labels.length ? `בטל: ${labels[0]}${labels.length > 1 ? ` (${labels.length} עריכות)` : ''}` : 'בטל'}>
        <Icon name="arrowLeft" size={15} /> בטל
      </button>
      <button type="button" onClick={redo} disabled={!canRedo || busy} style={btn(canRedo)} title="בצע מחדש">
        בצע מחדש <Icon name="arrowLeft" size={15} style={{ transform: 'scaleX(-1)' }} />
      </button>
      {labels.length > 0 && (
        <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{labels.length} עריכות</span>
      )}
    </div>
  )
}
