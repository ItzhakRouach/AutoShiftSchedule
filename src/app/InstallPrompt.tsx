'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed'

/**
 * Discoverable "install app" prompt for the already-configured PWA. On
 * Android/Chrome/Edge it captures the native `beforeinstallprompt` and triggers
 * the real install; on iOS Safari (which has no such event) it shows the
 * Share → "הוסף למסך הבית" hint. Renders nothing when already installed, when
 * dismissed, or when the browser offers no install path. All browser access is
 * in an effect, so SSR/first paint is an inert null (no hydration mismatch).
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    let cancelled = false

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // Client-only environment checks, deferred out of the synchronous effect
    // body so the reveal happens in a callback (no cascading render).
    queueMicrotask(() => {
      if (cancelled) return
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
      if (standalone || localStorage.getItem(DISMISS_KEY) === '1') return
      setHidden(false)
      const ua = window.navigator.userAgent
      if (/iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)) {
        setIosHint(true)
      }
    })

    return () => {
      cancelled = true
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setHidden(true)
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    dismiss()
  }

  if (hidden || (!deferred && !iosHint)) return null

  return (
    <div
      role="dialog"
      aria-label="התקנת האפליקציה"
      style={{
        position: 'fixed', insetInline: 12, bottom: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex: 60, maxWidth: 420, marginInline: 'auto',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', direction: 'rtl',
        background: 'var(--surface)', color: 'var(--text)',
        border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow, 0 8px 24px rgba(0,0,0,0.18))',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>התקינו את מִשְׁמֶרֶת</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>
          {deferred ? 'גישה מהירה ממסך הבית, גם ללא דפדפן.' : 'הקישו על שיתוף ואז «הוסף למסך הבית».'}
        </div>
      </div>
      {deferred && (
        <button
          type="button"
          onClick={install}
          style={{
            flexShrink: 0, padding: '9px 16px', borderRadius: 'var(--r-pill)',
            border: 'none', background: 'var(--accent)', color: '#fff',
            fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          התקנה
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="סגור"
        style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: '50%', border: 'none',
          background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', lineHeight: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}
