'use client'

import { useMemo, useState } from 'react'
import { groupCandidates, type GroupedCandidate } from '@/lib/schedule/candidate-groups'
import { buildEmpBalance } from '@/lib/schedule/emp-balance'
import { balanceLine, isAboveAverage } from '@/lib/schedule/balance-text'
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
  /** A worker who can be placed as-is. */
  onPick: (employeeId: string) => void
  /** A worker whose placement needs the manager's explicit approval first. */
  onPickOverride: (candidate: GroupedCandidate) => void
}

const heading = (color: string): React.CSSProperties => ({ fontSize: 'var(--text-body)', fontWeight: 800, color, margin: '4px 2px 0' })

/** The worker list inside the assign window, grouped by how good a fit each
 *  worker is: asked for this shift → free → possible with approval → cannot be
 *  placed (collapsed, each with its reason). Workers not eligible for the role
 *  are left out entirely (see groupCandidates). */
export function CandidateList({ view, meta, slot, busy, atCapacity, onPick, onPickOverride }: Props) {
  const g = useMemo(() => groupCandidates(view, meta, slot), [view, meta, slot])
  const balance = useMemo(() => buildEmpBalance(view), [view])
  const balanceById = useMemo(() => new Map(balance.map((r) => [r.employeeId, r])), [balance])
  const [query, setQuery] = useState('')
  // With nobody to offer, the reasons ARE the answer — show them straight away.
  const [showBlocked, setShowBlocked] = useState(() => g.requested.length + g.available.length + g.override.length === 0)

  const q = query.trim()
  const match = (rows: GroupedCandidate[]) => (q ? rows.filter((r) => r.name.includes(q)) : rows)
  const requested = match(g.requested)
  const available = match(g.available)
  const override = match(g.override)
  const placeable = requested.length + available.length + override.length
  const locked = busy || atCapacity

  const row = (r: GroupedCandidate, tone: CandTone) => {
    const b = balanceById.get(r.id)
    return (
      <CandidateRow
        key={r.id} name={r.name} color={r.color} tone={tone}
        stats={b ? balanceLine(b) : undefined}
        aboveAverage={tone !== 'blocked' && !!b && isAboveAverage(b.total, balance)}
        reason={r.reason || undefined}
        action={tone === 'blocked' ? undefined : atCapacity ? 'מלא' : tone === 'override' ? 'שיבוץ בכל זאת' : 'שיבוץ'}
        disabled={tone === 'blocked' || locked}
        onClick={tone === 'blocked' ? undefined : tone === 'override' ? () => onPickOverride(r) : () => onPick(r.id)}
      />
    )
  }

  const section = (title: string, color: string, rows: GroupedCandidate[], tone: CandTone) =>
    rows.length > 0 && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={heading(color)}>{title}</div>
        {rows.map((r) => row(r, tone))}
      </div>
    )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {g.shownCount > 8 && (
        <input
          type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש עובד…" aria-label="חיפוש עובד"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)',
            fontSize: 'var(--text-h3)', fontFamily: 'var(--font)', direction: 'rtl',
          }}
        />
      )}

      {placeable === 0 && (
        <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-2)', padding: '6px 2px' }}>
          {q ? 'לא נמצא עובד בשם הזה' : 'אין עובדים זמינים למשמרת הזו בתפקיד הזה'}
        </div>
      )}

      {section('✓ ביקשו את המשמרת הזו', 'var(--success)', requested, 'requested')}
      {section('זמינים', 'var(--text)', available, 'available')}
      {section('אפשר לשבץ, אבל דורש אישור שלך', 'var(--warning)', override, 'override')}

      {g.blocked.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            aria-expanded={showBlocked}
            onClick={() => setShowBlocked((v) => !v)}
            style={{ ...heading('var(--text-2)'), background: 'none', border: 'none', cursor: 'pointer', textAlign: 'start', padding: '6px 2px', fontFamily: 'var(--font)' }}
          >
            לא ניתן לשבץ ({g.blocked.length}) · {showBlocked ? 'הסתרה' : 'הצגת הסיבות'}
          </button>
          {showBlocked && g.blocked.map((r) => row(r, 'blocked'))}
        </div>
      )}
    </div>
  )
}
