'use client'

import { Avatar } from '@/components/ui/Avatar'

export interface PairCand { id: string; name: string; disabled: boolean; label: string; sel: boolean }

/** Selectable candidate list for one 12h-pair slot (בוקר / לילה). */
export function PairCandidateList({
  cands, busy, onPick, testId, colorById,
}: {
  cands: PairCand[]
  busy: boolean
  onPick: (id: string) => void
  testId: string
  colorById: (id: string) => string
}) {
  if (cands.length === 0) {
    return (
      <div data-testid={testId} style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '8px 11px', borderRadius: 12, background: 'var(--surface-2)' }}>
        אין עובד מתאים המשובץ במשמרת זו ביום שנבחר.
      </div>
    )
  }
  return (
    <div data-testid={testId} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '24vh', overflowY: 'auto' }}>
      {cands.map((c) => (
        <button key={c.id} disabled={c.disabled || busy} onClick={() => onPick(c.id)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 11px',
          borderRadius: 12, border: `1px solid ${c.sel ? 'var(--accent)' : 'var(--border)'}`,
          background: c.sel ? 'var(--accent-soft)' : 'var(--surface)', cursor: c.disabled ? 'default' : 'pointer',
          opacity: c.disabled ? 0.5 : 1, fontFamily: 'var(--font)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Avatar name={c.name} color={colorById(c.id)} size={26} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.name}</span>
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: c.disabled ? '#EB6A4E' : 'var(--accent)' }}>{c.label}</span>
        </button>
      ))}
    </div>
  )
}
