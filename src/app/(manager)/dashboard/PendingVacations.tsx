'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Btn } from '@/components/ui/Btn'
import { Icon } from '@/components/ui/Icon'
import { formatHebDate } from '@/lib/dates/week'
import type { PendingVacation } from '@/lib/vacations/pending'
import { approveVacation, rejectVacation } from './vacation-actions'

function range(v: PendingVacation): string {
  return v.dateFrom === v.dateTo
    ? formatHebDate(v.dateFrom)
    : `${formatHebDate(v.dateFrom)} – ${formatHebDate(v.dateTo)}`
}

function Row({ v, busy, onApprove, onReject }: {
  v: PendingVacation; busy: boolean; onApprove: () => void; onReject: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{v.employeeName}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{range(v)}</div>
      </div>
      <Btn variant="soft" size="sm" disabled={busy} onClick={onReject}>דחה</Btn>
      <Btn variant="primary" size="sm" disabled={busy} onClick={onApprove}>אשר</Btn>
    </div>
  )
}

/** Pending vacation requests: a dismissible popup on entry + a persistent card,
 *  each with approve/reject. */
export function PendingVacations({ items }: { items: PendingVacation[] }) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (items.length === 0) return null

  const act = (id: string, fn: (id: string) => Promise<unknown>) => {
    setBusyId(id)
    startTransition(async () => {
      await fn(id)
      setBusyId(null)
      router.refresh()
    })
  }
  const rows = (
    <div>
      {items.map((v) => (
        <Row
          key={v.id}
          v={v}
          busy={pending && busyId === v.id}
          onApprove={() => act(v.id, approveVacation)}
          onReject={() => act(v.id, rejectVacation)}
        />
      ))}
    </div>
  )

  return (
    <>
      {/* Popup on entry */}
      {!dismissed && (
        <div
          onClick={() => setDismissed(true)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--scrim)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, direction: 'rtl' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px, 100%)', maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lift)', padding: '20px 20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="plane" size={20} stroke={1.9} color="var(--accent)" />
              <div style={{ fontSize: 'var(--text-h2)', fontWeight: 800, color: 'var(--text)' }}>
                בקשות חופשה לאישור ({items.length})
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px', lineHeight: 1.6 }}>
              עובדים ביקשו חופשה. אשרו או דחו — רק חופשה מאושרת נחשבת כיום חופש בסידור.
            </p>
            {rows}
            <div style={{ marginTop: 14 }}>
              <Btn variant="outline" size="md" style={{ width: '100%' }} onClick={() => setDismissed(true)}>סגור</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Persistent card */}
      <Card style={{ padding: '14px 16px', marginBottom: 16, border: '1px solid var(--accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="plane" size={18} stroke={1.9} color="var(--accent)" />
          <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>
            בקשות חופשה לאישור ({items.length})
          </span>
        </div>
        {rows}
      </Card>
    </>
  )
}
