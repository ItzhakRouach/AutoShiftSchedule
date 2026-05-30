'use client'

import { useEffect } from 'react'

export default function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[SW] Registered:', registration.scope)
          })
          .catch((err) => {
            console.error('[SW] Registration failed:', err)
          })
      })
    }
  }, [])

  return null
}
