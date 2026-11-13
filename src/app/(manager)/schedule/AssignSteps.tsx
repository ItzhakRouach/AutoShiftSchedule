'use client'

import { Btn } from '@/components/ui/Btn'
import type { GroupedCandidate } from '@/lib/schedule/candidate-groups'

export type AssignMode = 'list' | 'twelve' | 'temp' | 'mark'

/** "Back to the worker list" — heads every secondary step of the assign window. */
export function BackToList({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Btn variant="outline" size="sm" onClick={onBack}>חזרה לרשימת העובדים</Btn>
    </div>
  )
}

/** The less common ways to fill a cell, kept out of the way of the worker list. */
export function MoreOptions({ canMark, onMode }: { canMark: boolean; onMode: (m: AssignMode) => void }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>אפשרויות נוספות</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Btn variant="soft" size="md" style={{ flex: '1 1 150px' }} onClick={() => onMode('twelve')} data-testid="assign-more-twelve">משמרת 12 שעות</Btn>
        <Btn variant="outline" size="md" style={{ flex: '1 1 150px' }} onClick={() => onMode('temp')} data-testid="assign-more-temp">עובד זמני</Btn>
        {canMark && (
          <Btn variant="outline" size="md" style={{ flex: '1 1 150px' }} onClick={() => onMode('mark')} data-testid="assign-more-mark">להשאיר ריק בכוונה</Btn>
        )}
      </div>
    </div>
  )
}

/** Explicit approval before placing a worker against their request/availability. */
export function OverrideConfirm({
  candidate, where, busy, onCancel, onConfirm,
}: {
  candidate: GroupedCandidate
  /** "יום שישי 20.11 · צהריים" */
  where: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div role="alertdialog" aria-label="אישור שיבוץ חריג" data-testid="assign-confirm" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ alignSelf: 'flex-start', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text)', background: 'var(--warning-soft)', border: '1px solid var(--warning)', padding: '4px 12px', borderRadius: 'var(--r-pill)' }}>
        דורש אישור
      </span>
      <div style={{ fontSize: 'var(--text-h1)', fontWeight: 800, color: 'var(--text)' }}>לשבץ את {candidate.name} בכל זאת?</div>
      <p style={{ margin: 0, fontSize: 'var(--text-h3)', lineHeight: 1.5, color: 'var(--text-2)' }}>
        {candidate.reason}. השיבוץ הוא ל{where}.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
        <Btn variant="outline" size="md" disabled={busy} onClick={onCancel}>ביטול</Btn>
        <Btn variant="primary" size="md" disabled={busy} onClick={onConfirm}>שיבוץ בכל זאת</Btn>
      </div>
    </div>
  )
}
