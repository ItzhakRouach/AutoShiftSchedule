'use client'

import { useEffect } from 'react'
import { Card } from './Card'
import { Btn } from './Btn'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Shared route-group error boundary UI (Next.js `error.tsx` contract). Each
 * route group re-exports this from a thin wrapper so recoverable render
 * errors show a Hebrew message + retry instead of the default error screen.
 */
export function RouteError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error.digest ?? error.message)
  }, [error])

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>
      <Card style={{ textAlign: 'center', padding: 32, maxWidth: 360 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
          משהו השתבש
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
          אירעה שגיאה בטעינת העמוד. ניתן לנסות שוב.
        </p>
        <Btn variant="primary" onClick={reset}>נסו שוב</Btn>
      </Card>
    </div>
  )
}
