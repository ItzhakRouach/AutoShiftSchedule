'use client'

import { useEffect, useState } from 'react'
import { saveSubscription, removeSubscription } from './push-actions'

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/** base64url VAPID key → Uint8Array for pushManager.subscribe. */
function urlB64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

type State = 'loading' | 'unsupported' | 'off' | 'on' | 'denied'

/** Employee opt-in for push notifications (deadline reminders + schedule
 *  published). Hidden when the browser can't do push or no VAPID key is set. */
export function PushToggle() {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!VAPID || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setState('unsupported'); return
      }
      if (Notification.permission === 'denied') { if (!cancelled) setState('denied'); return }
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!cancelled) setState(sub ? 'on' : 'off')
      } catch {
        if (!cancelled) setState('off')
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function enable() {
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); return }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID!) })
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const res = await saveSubscription({ endpoint: json.endpoint ?? '', p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' })
      setState(res.ok ? 'on' : 'off')
    } catch {
      setState('off')
    } finally { setBusy(false) }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) { await removeSubscription(sub.endpoint); await sub.unsubscribe() }
      setState('off')
    } finally { setBusy(false) }
  }

  if (state === 'loading' || state === 'unsupported') return null

  const on = state === 'on'
  const denied = state === 'denied'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--surface)', marginTop: 12 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>התראות פוש</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
          {denied ? 'ההרשאה נחסמה בדפדפן — יש לאפשר בהגדרות' : 'תזכורת לפני מועד הבקשות ועדכון כשמתפרסם סידור'}
        </div>
      </div>
      {!denied && (
        <button
          onClick={on ? disable : enable}
          disabled={busy}
          style={{
            flexShrink: 0, padding: '7px 14px', borderRadius: 'var(--r-pill)', fontFamily: 'var(--font)',
            fontSize: 12.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            border: `1.5px solid ${on ? 'var(--border)' : 'var(--accent)'}`,
            background: on ? 'var(--surface)' : 'var(--accent)', color: on ? 'var(--text-2)' : 'var(--accent-ink, #fff)',
          }}
        >
          {busy ? '…' : on ? 'כבה' : 'הפעל'}
        </button>
      )}
    </div>
  )
}
