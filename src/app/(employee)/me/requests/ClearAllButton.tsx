'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { clearAllRequests } from './actions'

interface Props {
  periodId: string
  /** True when at least one day has a preference OR is-off — otherwise nothing to clear. */
  hasAnyRequest: boolean
}

/**
 * Two-step confirm button: first click flips the label to "תאשר ניקוי" with a
 * 6-second escape window; second click within that window runs the wipe.
 * Avoids window.confirm (clunky on mobile + breaks RTL on some browsers).
 */
export function ClearAllButton({ periodId, hasAnyRequest }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, run] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  if (!hasAnyRequest) return null

  function startConfirm() {
    setMsg(null)
    setConfirming(true)
    // Reset confirm-state after 6s so a stray click doesn't linger.
    window.setTimeout(() => setConfirming(false), 6000)
  }

  function runClear() {
    setConfirming(false)
    setMsg(null)
    run(async () => {
      const r = await clearAllRequests(periodId)
      if ('error' in r) { setMsg(r.error); return }
      router.refresh()
    })
  }

  const label = busy
    ? 'מנקה…'
    : confirming
    ? 'לחצו שוב לאישור ניקוי'
    : 'נקה את כל הבקשות'

  return (
    <div style={{ margin: '14px 0' }}>
      <button
        type="button"
        data-testid="clear-all-requests"
        disabled={busy}
        onClick={confirming ? runClear : startConfirm}
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
        <div role="status" style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(220,70,70,0.1)', color: 'var(--danger)', fontSize: 13 }}>
          {msg}
        </div>
      )}
    </div>
  )
}
