'use client'

import React, { useState, useTransition } from 'react'
import { createInvite } from './invite-actions'

interface InvitePanelProps {
  initialCode: string | null
  workplaceName: string
  baseUrl: string
}

export function InvitePanel({ initialCode, workplaceName, baseUrl }: InvitePanelProps) {
  const [code, setCode] = useState<string | null>(initialCode)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const joinUrl = code ? `${baseUrl}/join/${code}` : null

  const waText = joinUrl
    ? encodeURIComponent(
        `שלום! הוזמנת להצטרף ל${workplaceName} באפליקציית AutoShift.\nלחץ כאן להצטרפות: ${joinUrl}`,
      )
    : null

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const result = await createInvite()
      if ('error' in result) {
        setError(result.error)
      } else {
        setCode(result.code)
        setCopied(false)
      }
    })
  }

  async function handleCopy() {
    if (!joinUrl) return
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('ההעתקה נכשלה. העתיקו את הלינק ידנית.')
    }
  }

  return (
    <div
      style={{
        padding: '18px 20px',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        marginBottom: 24,
      }}
    >
      <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
        הזמנת עובדים
      </h2>

      {error && (
        <p style={{ color: '#D8423B', fontSize: 13, marginBottom: 12 }}>{error}</p>
      )}

      {code && joinUrl && waText ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              background: 'var(--surface-2)',
              borderRadius: 'var(--r-md)',
              padding: '10px 14px',
              fontFamily: 'monospace',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: 'var(--accent)',
              textAlign: 'center',
            }}
          >
            {code}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCopy}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 'var(--r-pill)',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {copied ? 'הועתק ✓' : 'העתק לינק'}
            </button>

            <a
              href={`https://wa.me/?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 'var(--r-pill)',
                border: '1px solid transparent',
                background: '#25D366',
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textDecoration: 'none',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              שתף בוואטסאפ
            </a>
          </div>

          <button
            onClick={handleCreate}
            disabled={isPending}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--r-pill)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-2)',
              fontSize: 13,
              cursor: isPending ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: isPending ? 0.5 : 1,
            }}
          >
            {isPending ? 'יוצר...' : 'צור קוד חדש'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleCreate}
          disabled={isPending}
          style={{
            padding: '12px 20px',
            borderRadius: 'var(--r-pill)',
            border: '1px solid transparent',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 15,
            cursor: isPending ? 'default' : 'pointer',
            fontFamily: 'inherit',
            opacity: isPending ? 0.5 : 1,
            width: '100%',
          }}
        >
          {isPending ? 'יוצר הזמנה...' : 'צור קוד הזמנה'}
        </button>
      )}
    </div>
  )
}
