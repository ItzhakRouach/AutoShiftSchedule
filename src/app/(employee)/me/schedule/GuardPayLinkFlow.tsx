'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { findGuardPayAccount, linkGuardPay } from './guardpay-actions'

type Stage =
  | { kind: 'searching' }
  | { kind: 'found'; name: string; email: string; manual: boolean }
  | { kind: 'manual'; error?: string }

/**
 * Inline link flow: auto-match by the account email first; fall back to a
 * manual email field (Apple "הסתר את האימייל שלי" users enter their relay
 * address from הגדרות Apple ID). The Appwrite user id never reaches the
 * client — linkGuardPay re-runs the lookup server-side.
 */
export function GuardPayLinkFlow({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>({ kind: 'searching' })
  const [email, setEmail] = useState('')
  const [busy, run] = useTransition()

  useEffect(() => {
    let cancelled = false
    findGuardPayAccount({}).then((r) => {
      if (cancelled) return
      if ('ok' in r) setStage({ kind: 'found', name: r.name, email: r.email, manual: false })
      else setStage({ kind: 'manual', error: r.error })
    })
    return () => {
      cancelled = true
    }
  }, [])

  function lookupManual() {
    const value = email.trim()
    if (!value) return
    run(async () => {
      const r = await findGuardPayAccount({ email: value })
      if ('ok' in r) setStage({ kind: 'found', name: r.name, email: r.email, manual: true })
      else setStage({ kind: 'manual', error: r.error })
    })
  }

  function confirmLink(s: Extract<Stage, { kind: 'found' }>) {
    run(async () => {
      const r = await linkGuardPay(s.manual ? { email: s.email } : {})
      if ('error' in r) {
        setStage({ kind: 'manual', error: r.error })
        return
      }
      router.refresh()
      onClose()
    })
  }

  const box = {
    marginTop: 10,
    padding: '12px 14px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    fontSize: 13.5,
  } as const

  if (stage.kind === 'searching') {
    return <div style={box}>מאתר חשבון GuardPay לפי האימייל שלך…</div>
  }

  if (stage.kind === 'found') {
    return (
      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          נמצא חשבון GuardPay על שם {stage.name} — לקשר?
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            data-testid="guardpay-link-confirm"
            disabled={busy}
            onClick={() => confirmLink(stage)}
            style={{ flex: 1, padding: '9px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontFamily: 'var(--font)', cursor: 'pointer' }}
          >
            {busy ? 'מקשר…' : 'קישור החשבון'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStage({ kind: 'manual' })}
            style={{ flex: 1, padding: '9px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-2)', fontWeight: 700, fontFamily: 'var(--font)', cursor: 'pointer' }}
          >
            זה לא אני
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={box}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>הזנת אימייל של חשבון GuardPay</div>
      <p style={{ margin: '0 0 8px', color: 'var(--text-2)', lineHeight: 1.5 }}>
        האימייל שאיתו נרשמת ל-GuardPay. נרשמת עם Apple ובחרת ״הסתר את האימייל שלי״? הזינו את
        כתובת ה-relay מהגדרות Apple ID.
      </p>
      {stage.error && (
        <div role="status" style={{ marginBottom: 8, padding: '7px 10px', borderRadius: 10, background: 'rgba(220,70,70,0.1)', color: 'var(--danger)' }}>
          {stage.error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          dir="ltr"
          data-testid="guardpay-manual-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          style={{ flex: 1, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font)' }}
        />
        <button
          type="button"
          disabled={busy || !email.trim()}
          onClick={lookupManual}
          style={{ padding: '9px 16px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontFamily: 'var(--font)', cursor: 'pointer' }}
        >
          {busy ? 'מאתר…' : 'איתור'}
        </button>
      </div>
    </div>
  )
}
