'use client'

import { useState } from 'react'
import { Btn } from '@/components/ui/Btn'

interface Props {
  busy: boolean
  /** The slot's current caption — `undefined` when the slot isn't marked,
   *  `''` when it is marked with no caption. */
  currentLabel?: string
  /** Save the (possibly empty) caption and mark the slot. */
  onSubmit: (label: string) => void
  /** Drop the mark — the slot goes back to being a real "לא מאויש" gap. */
  onClear: () => void
}

const INPUT_STYLE: React.CSSProperties = {
  flex: 1, padding: '8px 11px', borderRadius: 12, fontSize: 14,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontFamily: 'var(--font)',
}

/**
 * Marks an empty slot as intentionally empty, with an optional caption shown
 * inside the cell (e.g. "יום כיפור"). A marked cell renders neutral instead of
 * the red "לא מאויש" and stops counting toward the week's coverage gaps.
 * Rendered only for cells that have no occupant and no 12h coverage.
 */
export function SlotMarkPrompt({ busy, currentLabel, onSubmit, onClear }: Props) {
  const marked = currentLabel !== undefined
  const [label, setLabel] = useState(currentLabel ?? '')
  const trimmed = label.trim()

  function submit() {
    // The button is disabled while a dispatch is in flight; the Enter key has to
    // honor the same guard or a held key fires a burst of server actions.
    if (busy) return
    onSubmit(trimmed)
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '0 0 4px' }}>
        סימון המשבצת כריקה בכוונה
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 8px' }}>
        המשבצת תוצג לבנה עם הטקסט שתכתבו, ולא תיספר כמשבצת לא מאוישת.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          maxLength={30}
          placeholder="לדוגמה: יום כיפור"
          aria-label="טקסט לסימון המשבצת"
          style={INPUT_STYLE}
        />
        <Btn variant="outline" size="md" disabled={busy} onClick={submit}>
          {marked ? 'עדכן' : 'סמן כלבן'}
        </Btn>
      </div>
      {marked && (
        <div style={{ marginTop: 8 }}>
          <Btn variant="danger" size="sm" disabled={busy} onClick={onClear}>
            הסר סימון
          </Btn>
        </div>
      )}
    </div>
  )
}
