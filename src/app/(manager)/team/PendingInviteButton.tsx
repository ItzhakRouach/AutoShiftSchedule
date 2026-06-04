'use client'

import { useState, useTransition } from 'react'
import { getInviteShareLinkForEmployee } from './invite-actions'

interface Props {
  employeeId: string
  hasPhone: boolean
}

/**
 * Tiny inline button next to a "טרם הצטרף" employee. Resolves the workplace's
 * active invite into a pre-filled `wa.me` link addressed to the employee's
 * phone, then opens it in a new tab so the manager can review and send via
 * WhatsApp's own UI. Zero per-message cost, no third-party API in the loop.
 */
export function PendingInviteButton({ employeeId, hasPhone }: Props) {
  const [, run] = useTransition()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!hasPhone) return null

  function send(ev: React.MouseEvent) {
    ev.stopPropagation()
    setMsg(null)
    setBusy(true)
    run(async () => {
      const r = await getInviteShareLinkForEmployee(employeeId)
      setBusy(false)
      if (!r.ok) { setMsg(r.error); return }
      // Open in a new tab so we don't lose the team list view.
      window.open(r.waUrl, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <>
      <button
        type="button"
        data-testid="resend-invite"
        onClick={send}
        disabled={busy}
        title="פתח WhatsApp עם הודעת ההזמנה ממולאת מראש"
        style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px',
          borderRadius: 'var(--r-pill)', border: '1px solid #25D366',
          background: busy ? 'var(--surface-2)' : 'rgba(37,211,102,0.10)',
          color: '#25D366', cursor: busy ? 'default' : 'pointer',
          fontFamily: 'var(--font)', flexShrink: 0,
        }}
      >
        {busy ? 'מכין…' : 'שלח בוואטסאפ'}
      </button>
      {msg && (
        <span role="status" style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', flexShrink: 0 }}>
          {msg}
        </span>
      )}
    </>
  )
}
