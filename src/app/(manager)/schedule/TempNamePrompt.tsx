'use client'

import { useState } from 'react'
import { Btn } from '@/components/ui/Btn'

interface Props {
  busy: boolean
  /** Submit the trimmed temp name; resolves when the action settles. */
  onSubmit: (name: string) => void
}

/** Inline input to drop an ad-hoc "temp" worker name into the open slot — for
 *  filling a cell with someone who isn't in the employee roster. */
export function TempNamePrompt({ busy, onSubmit }: Props) {
  const [name, setName] = useState('')
  const trimmed = name.trim()

  function submit() {
    if (!trimmed) return
    onSubmit(trimmed)
    setName('')
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '0 0 8px' }}>
        הוספת עובד זמני (שם חופשי)
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          maxLength={40}
          placeholder="שם העובד הזמני"
          aria-label="שם עובד זמני"
          style={{
            flex: 1, padding: '8px 11px', borderRadius: 12, fontSize: 14,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text)', fontFamily: 'var(--font)',
          }}
        />
        <Btn variant="outline" size="md" disabled={busy || !trimmed} onClick={submit}>
          הוסף
        </Btn>
      </div>
    </div>
  )
}
