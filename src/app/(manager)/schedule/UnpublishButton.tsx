'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { unpublishSchedule } from './actions'

interface Props {
  periodId: string
  /** Called after a successful unpublish so the parent can clear its local
   *  `published` flag without waiting for the next render. */
  onDone?: () => void
}

/**
 * Two-step confirm button: first click flips the label to "לחצו שוב לאישור
 * ביטול" with a 6-second escape window; second click within that window
 * unpublishes the schedule (status → 'locked') and best-effort deletes the
 * image. Mirrors ClearAllButton's interaction + styling 1:1.
 */
export function UnpublishButton({ periodId, onDone }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, run] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function startConfirm() {
    setMsg(null)
    setConfirming(true)
    // Reset confirm-state after 6s so a stray click doesn't linger.
    window.setTimeout(() => setConfirming(false), 6000)
  }

  function runUnpublish() {
    setConfirming(false)
    setMsg(null)
    run(async () => {
      const r = await unpublishSchedule(periodId)
      if (!r.ok) { setMsg(r.error ?? 'שגיאה'); return }
      onDone?.()
      router.refresh()
    })
  }

  const label = busy
    ? 'מבטל פרסום…'
    : confirming
    ? 'לחצו שוב לאישור ביטול'
    : 'ביטול פרסום'

  return (
    <div style={{ margin: '10px 0 0' }}>
      <button
        type="button"
        data-testid="unpublish-schedule"
        disabled={busy}
        onClick={confirming ? runUnpublish : startConfirm}
        style={{
          width: '100%',
          padding: '11px',
          borderRadius: 14,
          fontSize: 13.5,
          fontWeight: 700,
          fontFamily: 'var(--font)',
          cursor: busy ? 'default' : 'pointer',
          border: `1px solid ${confirming ? 'var(--danger)' : 'var(--border-strong)'}`,
          background: confirming ? 'rgba(220,70,70,0.08)' : 'var(--surface)',
          color: confirming ? 'var(--danger)' : 'var(--text-2)',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {label}
      </button>
      {msg && (
        <div
          role="status"
          style={{
            marginTop: 8,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(220,70,70,0.1)',
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          {msg}
        </div>
      )}
    </div>
  )
}
