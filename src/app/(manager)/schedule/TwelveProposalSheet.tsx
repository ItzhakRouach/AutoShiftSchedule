'use client'

import { useEffect, useState, useTransition } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Btn } from '@/components/ui/Btn'
import { Spinner } from '@/components/ui/Spinner'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { LtrText } from '@/components/ui/LtrText'
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import { dayTitle } from '@/lib/domain/days'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { ProposalDay, TwelveProposal } from '@/lib/schedule/twelve-proposal'
import { previewTwelveHour } from './twelve-proposal-actions'

const TWELVE = new Set(['m12_day', 'm12_night', 'm12_3to15', 'm12_15to3'])
const shiftName = (k: string | null) => (k ? SHIFT_META[k as ShiftId]?.name ?? k : '')

function changeText(c: ProposalDay['changes'][number]): string {
  if (!c.from) return `${c.name} נכנס/ת ל${shiftName(c.to)}`
  if (!c.to) return `${c.name} יוצא/ת מ${shiftName(c.from)}`
  return `${c.name}: ${shiftName(c.from)} ← ${shiftName(c.to)}`
}

function DayCard({ d, date }: { d: ProposalDay; date: string }) {
  const moves = d.changes.filter((c) => !(c.to && TWELVE.has(c.to)))
  const line: React.CSSProperties = { fontSize: 'var(--text-body)', color: 'var(--text)', lineHeight: 1.6 }
  return (
    <div data-testid="proposal-day" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 12px', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <strong style={{ fontSize: 'var(--text-h3)' }}>{dayTitle(d.day)} {date}</strong>
        <span className="tabular" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: d.openAfter < d.openBefore ? 'var(--success)' : 'var(--text-2)' }}>
          פתוחות {d.openBefore} ← {d.openAfter}
        </span>
      </div>
      {d.pairs.map((p) => (
        <div key={`${p.employeeId}${p.variant}`} style={line}>
          <span style={{ display: 'inline-block', minWidth: 104, fontWeight: 700, background: 'var(--warning-soft)', borderRadius: 6, padding: '0 6px', marginInlineEnd: 6, textAlign: 'center' }}>
            <LtrText>{SHIFT_META[p.variant as ShiftId]?.time ?? p.variant}</LtrText>
          </span>
          {p.name} <span style={{ color: 'var(--text-2)' }}>({p.roles.join(' + ')})</span>
        </div>
      ))}
      {moves.map((c) => <div key={c.employeeId} style={{ ...line, color: 'var(--text-2)' }}>{changeText(c)}</div>)}
      {d.overrides.map((o) => (
        <div key={o.employeeId} style={{ ...line, color: 'var(--warning)', fontWeight: 700 }}>
          {o.name} שובץ/ה ל{shiftName(o.shift)} ביום שביקש/ה חופש
        </div>
      ))}
    </div>
  )
}

/**
 * Shows the 12h plan for the week before anything is saved, then applies it on
 * approval (owner rule, 2026-11-14). The preview and the apply run the same
 * deterministic engine, so what is shown is what gets saved.
 */
export function TwelveProposalSheet({ open, onClose, view, running, onApply }: {
  open: boolean
  onClose: () => void
  view: ScheduleView
  running: boolean
  onApply: () => void
}) {
  const [proposal, setProposal] = useState<TwelveProposal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, start] = useTransition()

  useEffect(() => {
    if (!open) return
    start(async () => {
      const res = await previewTwelveHour(view.periodId)
      if (res.ok) { setProposal(res.proposal); setError(null) } else setError(res.error)
    })
  }, [open, view.periodId, view])

  const helps = !!proposal && (proposal.openAfter < proposal.openBefore || proposal.days.length > 0)

  return (
    <Sheet open={open} onClose={onClose} title="הצעה למשמרות 12 שעות" testId="twelve-proposal">
      {loading || (!proposal && !error) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 2px', color: 'var(--text-2)' }}>
          <Spinner size={18} /> מחשב הצעה…
        </div>
      ) : error ? (
        <InlineAlert kind="error">{error}</InlineAlert>
      ) : proposal && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div data-testid="proposal-summary" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="tabular" style={{ fontWeight: 800, padding: '6px 12px', borderRadius: 'var(--r-pill)', background: proposal.openAfter === 0 ? 'var(--success-soft)' : 'var(--warning-soft)' }}>
              משבצות פתוחות: {proposal.openBefore} ← {proposal.openAfter}
            </span>
            <span className="tabular" style={{ fontWeight: 700, padding: '6px 12px', borderRadius: 'var(--r-pill)', background: 'var(--surface-sunk)' }}>
              משמרות 12 שעות: {proposal.twelveCount}
            </span>
          </div>
          {helps ? (
            <>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
                כל 07:00–19:00 מקבל/ת מחליף/ה ב־19:00. שיבוצים ידניים שעשית נשמרים.
              </p>
              {proposal.days.map((d) => <DayCard key={d.day} d={d} date={view.days[d.day]?.date ?? ''} />)}
            </>
          ) : (
            <InlineAlert kind="info">לא נמצאה דרך לכסות עוד משבצות עם משמרות 12 שעות. אפשר לשבץ ידנית או לבקש מעובד לוותר על יום חופש.</InlineAlert>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 4 }}>
            <Btn variant="outline" size="md" onClick={onClose}>ביטול</Btn>
            <Btn variant="primary" size="md" disabled={!helps || running} onClick={() => { onClose(); onApply() }} data-testid="proposal-apply">
              אישור והחלה
            </Btn>
          </div>
        </div>
      )}
    </Sheet>
  )
}
