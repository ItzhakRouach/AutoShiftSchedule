'use client'

import { useMemo, useState } from 'react'
import { groupCandidates, type GroupedCandidate } from '@/lib/schedule/candidate-groups'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { SlotCtx } from './SwapEditor'
import { CandidateRow, type CandTone } from './CandidateRow'

interface Props {
  view: ScheduleView
  meta: EditMeta
  slot: SlotCtx
  busy: boolean
  atCapacity: boolean
  onPick: (employeeId: string) => void
}

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '4px 2px' }

/** The "available employees" list inside the slot editor sheet. Workers are
 *  grouped (requested / available / needs-override) and filtered — ineligible
 *  and already-assigned-elsewhere workers are hidden (see groupCandidates).
 *  Hard-blocked workers live in a collapsed "לא זמינים" section. */
export function CandidateList({ view, meta, slot, busy, atCapacity, onPick }: Props) {
  const g = useMemo(() => groupCandidates(view, meta, slot), [view, meta, slot])
  const [query, setQuery] = useState('')
  const [showBlocked, setShowBlocked] = useState(false)

  const q = query.trim()
  const match = (rows: GroupedCandidate[]) => (q ? rows.filter((r) => r.name.includes(q)) : rows)
  const requested = match(g.requested)
  const available = match(g.available)
  const override = match(g.override)
  const placeable = requested.length + available.length + override.length

  const pick = (id: string) => { if (!busy && !atCapacity) onPick(id) }

  const Section = (title: string, rows: GroupedCandidate[], tone: CandTone) =>
    rows.length > 0 && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>{title}</div>
        {rows.map((r) => (
          <CandidateRow key={r.id} name={r.name} color={r.color} label={atCapacity ? 'מלא' : r.label}
            tone={tone} disabled={busy || atCapacity} onClick={() => pick(r.id)} />
        ))}
      </div>
    )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {g.shownCount > 8 && (
        <input
          type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש עובד…" aria-label="חיפוש עובד"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)',
            fontSize: 14, fontFamily: 'var(--font)', direction: 'rtl',
          }}
        />
      )}

      {placeable === 0 && g.blocked.length === 0 && (
        <div style={{ fontSize: 14, color: 'var(--text-3)', padding: '10px 2px' }}>אין עובדים זמינים לתפקיד זה</div>
      )}

      {Section('ביקשו משמרת זו', requested, 'requested')}
      {Section('זמינים', available, 'available')}
      {Section('דורש אישור', override, 'override')}

      {g.blocked.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={() => setShowBlocked((v) => !v)}
            style={{ ...labelStyle, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'start', padding: '4px 2px', fontFamily: 'var(--font)' }}
          >
            {showBlocked ? 'הסתר לא זמינים' : `הצג לא זמינים (${g.blocked.length})`}
          </button>
          {showBlocked && g.blocked.map((r) => (
            <CandidateRow key={r.id} name={r.name} color={r.color} label={r.label} tone="blocked" disabled onClick={undefined} />
          ))}
        </div>
      )}
    </div>
  )
}
