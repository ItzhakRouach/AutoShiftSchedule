'use client'

import { useEffect } from 'react'

export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // In dev: actively unregister any previously-installed SW + clear caches.
    // A SW that survives across `next dev` rebuilds will serve stale HTML whose
    // embedded server-action IDs no longer exist on the server, causing POSTs
    // to hang with no log and no timeout (e.g. "צור סידור" stuck on
    // "בונה את הסידור…").
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) r.unregister()
      })
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
      }
      return
    }

    // When a new SW (bumped CACHE_NAME) takes control after a deploy, reload
    // once so the shell + its embedded server-action IDs are fresh — otherwise
    // a tab open across a deploy calls dead action IDs and every action errors.
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    })

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          registration.update()
          console.log('[SW] Registered:', registration.scope)
        })
        .catch((err) => {
          console.error('[SW] Registration failed:', err)
        })
    })
  }, [])

  return null
}
