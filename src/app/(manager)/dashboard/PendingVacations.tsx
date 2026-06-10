'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Btn } from '@/components/ui/Btn'
import { Icon } from '@/components/ui/Icon'
import { formatHebDate } from '@/lib/dates/week'
import type { WorkplaceVacation, VacationStatus } from '@/lib/vacations/pending'
import { approveVacation, rejectVacation } from './vacation-actions'

const STATUS_META: Record<VacationStatus, { label: string; color: string; soft: string }> = {
  pending: { label: 'ממתין', color: 'var(--warning)', soft: 'var(--warning-soft)' },
  approved: { label: 'אושר', color: 'var(--success)', soft: 'var(--success-soft)' },
  rejected: { label: 'נדחה', color: 'var(--danger)', soft: 'var(--danger-soft)' },
}

function range(v: WorkplaceVacation): string {
  return v.dateFrom === v.dateTo
    ? formatHebDate(v.dateFrom)
    : `${formatHebDate(v.dateFrom)} – ${formatHebDate(v.dateTo)}`
}

function StatusPill({ status }: { status: VacationStatus }) {
  const m = STATUS_META[status]
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: m.color, background: m.soft, padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
      {m.label}
    </span>
  )
}

function Row({ v, busy, onSet }: { v: WorkplaceVacation; busy: boolean; onSet: (s: 'approved' | 'rejected') => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{v.employeeName}</span>
          <StatusPill status={v.status} />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{range(v)}</div>
      </div>
      {/* Always editable: the current decision is the filled button. */}
      <Btn variant={v.status === 'rejected' ? 'soft' : 'outline'} size="sm" disabled={busy} onClick={() => onSet('rejected')}>דחה</Btn>
      <Btn variant={v.status === 'approved' ? 'primary' : 'outline'} size="sm" disabled={busy} onClick={() => onSet('approved')}>אשר</Btn>
    </div>
  )
}

/** Workplace vacation requests: a dismissible popup on entry (pending only) +
 *  a persistent, always-editable card (any status → approve/reject anytime). */
export function PendingVacations({ items }: { items: WorkplaceVacation[] }) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (items.length === 0) return null
  const pending = items.filter((v) => v.status === 'pending')

  const setStatus = (id: string, status: 'approved' | 'rejected') => {
    setBusyId(id)
    startTransition(async () => {
      await (status === 'approved' ? approveVacation(id) : rejectVacation(id))
      setBusyId(null)
      router.refresh()
    })
  }

  const list = (
    <div>
      {items.map((v) => (
        <Row key={v.id} v={v} busy={busyId === v.id} onSet={(s) => setStatus(v.id, s)} />
      ))}
    </div>
  )

  return (
    <>
      {/* Popup on entry — only when there are PENDING requests to act on. */}
      {!dismissed && pending.length > 0 && (
        <div
          onClick={() => setDismissed(true)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--scrim)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, direction: 'rtl' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px, 100%)', maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lift)', padding: '20px 20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="plane" size={20} stroke={1.9} color="var(--accent)" />
              <div style={{ fontSize: 'var(--text-h2)', fontWeight: 800, color: 'var(--text)' }}>
                בקשות חופשה לאישור ({pending.length})
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px', lineHeight: 1.6 }}>
              עובדים ביקשו חופשה. אשרו או דחו — רק חופשה מאושרת נחשבת כיום חופש בסידור.
            </p>
            <div>
              {pending.map((v) => (
                <Row key={v.id} v={v} busy={busyId === v.id} onSet={(s) => setStatus(v.id, s)} />
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <Btn variant="outline" size="md" style={{ width: '100%' }} onClick={() => setDismissed(true)}>סגור</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Persistent, editable card — all current/upcoming vacations. */}
      <Card style={{ padding: '14px 16px', marginBottom: 16, border: `1px solid ${pending.length > 0 ? 'var(--accent)' : 'var(--border)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="plane" size={18} stroke={1.9} color="var(--accent)" />
          <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>
            חופשות{pending.length > 0 ? ` · ${pending.length} לאישור` : ''}
          </span>
        </div>
        {list}
      </Card>
    </>
  )
}
