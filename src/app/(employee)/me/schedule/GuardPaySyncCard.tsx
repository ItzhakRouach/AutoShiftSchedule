'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { syncWeekToGuardPay, unlinkGuardPay } from './guardpay-actions'
import { GuardPayLinkFlow } from './GuardPayLinkFlow'

interface Props {
  periodId: string
  linked: boolean
  linkedName: string | null
  synced: boolean
  hasShifts: boolean
}

/** Branded GuardPay band under the week navigator. The app icon is the visual
 *  anchor; re-sync and unlink use the repo's two-step inline confirm idiom. */
export function GuardPaySyncCard({ periodId, linked, linkedName, synced, hasShifts }: Props) {
  const router = useRouter()
  const [linkOpen, setLinkOpen] = useState(false)
  const [confirmResync, setConfirmResync] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [busy, run] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function armed(set: (v: boolean) => void) {
    setMsg(null)
    set(true)
    window.setTimeout(() => set(false), 6000)
  }

  function runSync() {
    setConfirmResync(false)
    setMsg(null)
    run(async () => {
      const r = await syncWeekToGuardPay({ periodId })
      if ('error' in r) {
        setMsg(r.error)
        return
      }
      router.refresh()
    })
  }

  function runUnlink() {
    setConfirmUnlink(false)
    setMsg(null)
    run(async () => {
      const r = await unlinkGuardPay()
      if ('error' in r) {
        setMsg(r.error)
        return
      }
      router.refresh()
    })
  }

  const icon = (
    <Image
      src="/guardpay-icon.png"
      alt="GuardPay"
      width={44}
      height={44}
      style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.18)', flexShrink: 0 }}
    />
  )

  const card = {
    marginTop: 12,
    padding: '12px 14px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
  } as const

  if (!linked) {
    return (
      <div style={card}>
        <button
          type="button"
          data-testid="guardpay-connect"
          onClick={() => setLinkOpen((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'start', fontFamily: 'var(--font)' }}
        >
          {icon}
          <span>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>חיבור ל-GuardPay</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-2)' }}>ייבוא המשמרות ישירות לאפליקציית השכר</span>
          </span>
        </button>
        {linkOpen && <GuardPayLinkFlow onClose={() => setLinkOpen(false)} />}
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            מחובר ל-GuardPay{linkedName ? ` · ${linkedName}` : ''}
          </div>
          {synced && (
            <div data-testid="guardpay-synced-badge" style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--accent)' }}>
              יובא ל-GuardPay ✓
            </div>
          )}
        </div>
        <button
          type="button"
          data-testid="guardpay-sync"
          disabled={busy || !hasShifts}
          onClick={synced && !confirmResync ? () => armed(setConfirmResync) : runSync}
          title={hasShifts ? undefined : 'אין לך משמרות בשבוע הזה'}
          style={{
            padding: '9px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
            cursor: busy || !hasShifts ? 'default' : 'pointer',
            border: confirmResync ? '1px solid var(--danger)' : 'none',
            background: confirmResync ? 'rgba(220,70,70,0.08)' : 'var(--accent)',
            color: confirmResync ? 'var(--danger)' : '#fff',
            opacity: hasShifts ? 1 : 0.55,
          }}
        >
          {busy ? 'מייבא…' : confirmResync ? 'לחצו שוב לייבוא מחדש' : synced ? 'ייבוא מחדש' : 'ייבוא המשמרות ל-GuardPay'}
        </button>
      </div>
      {confirmResync && (
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--text-2)' }}>
          ייבוא מחדש מחליף את המשמרות שיובאו בעבר לשבוע הזה (משמרות שהוזנו ידנית ב-GuardPay לא נמחקות).
        </p>
      )}
      {msg && (
        <div role="status" style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(220,70,70,0.1)', color: 'var(--danger)', fontSize: 13 }}>
          {msg}
        </div>
      )}
      <button
        type="button"
        data-testid="guardpay-unlink"
        disabled={busy}
        onClick={confirmUnlink ? runUnlink : () => armed(setConfirmUnlink)}
        style={{ marginTop: 8, border: 'none', background: 'none', padding: 0, fontSize: 12, fontFamily: 'var(--font)', cursor: 'pointer', color: confirmUnlink ? 'var(--danger)' : 'var(--text-2)', textDecoration: 'underline' }}
      >
        {confirmUnlink ? 'לחצו שוב לאישור ניתוק' : 'ניתוק החשבון'}
      </button>
    </div>
  )
}
