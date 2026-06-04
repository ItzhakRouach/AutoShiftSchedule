'use client'

import { useState, useTransition } from 'react'
import { resendInviteToEmployee } from './invite-actions'

interface Props {
  employeeId: string
  hasPhone: boolean
}

/**
 * Tiny inline button next to a "טרם הצטרף" employee that re-sends the
 * workplace's active invite to their phone via GreenAPI. When GreenAPI isn't
 * configured the server-side action returns a Hebrew warning that we show in
 * place of the success state. No-ops when the employee has no phone.
 */
export function PendingInviteButton({ employeeId, hasPhone }: Props) {
  const [, run] = useTransition()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [tone, setTone] = useState<'ok' | 'warn' | 'err'>('ok')

  if (!hasPhone) return null

  function send(ev: React.MouseEvent) {
    ev.stopPropagation()
    setMsg(null)
    setBusy(true)
    run(async () => {
      const r = await resendInviteToEmployee(employeeId)
      setBusy(false)
      if (!r.ok) { setTone('err'); setMsg(r.error ?? 'שגיאה'); return }
      if (r.warning) { setTone('warn'); setMsg(r.warning); return }
      setTone('ok'); setMsg('הזמנה נשלחה')
      window.setTimeout(() => setMsg(null), 4000)
    })
  }

  return (
    <>
      <button
        type="button"
        data-testid="resend-invite"
        onClick={send}
        disabled={busy}
        title="שלח את קישור ההזמנה לטלפון העובד דרך WhatsApp"
        style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px',
          borderRadius: 'var(--r-pill)', border: '1px solid var(--accent)',
          background: busy ? 'var(--surface-2)' : 'var(--accent-soft)',
          color: 'var(--accent)', cursor: busy ? 'default' : 'pointer',
          fontFamily: 'var(--font)', flexShrink: 0,
        }}
      >
        {busy ? 'שולח…' : 'שלח הזמנה'}
      </button>
      {msg && (
        <span
          role="status"
          style={{
            fontSize: 11, fontWeight: 700, flexShrink: 0,
            color: tone === 'err' ? 'var(--danger)' : tone === 'warn' ? '#9A6500' : 'var(--accent)',
          }}
        >
          {msg}
        </span>
      )}
    </>
  )
}
