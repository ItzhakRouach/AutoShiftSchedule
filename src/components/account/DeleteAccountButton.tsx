'use client'

import { useState, useTransition } from 'react'

export interface DeleteAccountResult {
  error?: string
}

interface Props {
  /** Server action that deletes the current user's account (redirects on success). */
  action: () => Promise<DeleteAccountResult | void>
  /** Optional override of the warning text shown in the confirm dialog. */
  description?: string
}

const DEFAULT_DESC = 'פעולה זו תמחק את חשבונך והנתונים שלך לצמיתות. לא ניתן לבטל פעולה זו.'

export function DeleteAccountButton({ action, description }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result?.error) setError(result.error)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="nav-logout"
        style={{
          background: 'none',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          borderRadius: 'var(--r-pill)',
          padding: '10px 24px',
        }}
      >
        מחיקת חשבון
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dlg-title"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 24,
          }}
        >
          <div
            style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg)',
              padding: '28px 24px', maxWidth: 360, width: '100%',
              direction: 'rtl', textAlign: 'right', boxShadow: 'var(--shadow-lift)',
            }}
          >
            <h2 id="delete-dlg-title" style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
              מחיקת חשבון
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {description ?? DEFAULT_DESC}
            </p>
            {error && (
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-start' }}>
              <button
                type="button" onClick={handleConfirm} disabled={isPending}
                style={{
                  background: 'var(--danger)', color: '#fff', border: 'none',
                  borderRadius: 'var(--r-md)', padding: '10px 20px', fontSize: 14, fontWeight: 700,
                  cursor: isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: isPending ? 0.7 : 1,
                }}
              >
                {isPending ? 'מוחק...' : 'מחיקה סופית'}
              </button>
              <button
                type="button" onClick={() => { setOpen(false); setError(null) }} disabled={isPending}
                style={{
                  background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)', padding: '10px 20px', fontSize: 14, fontWeight: 700,
                  cursor: isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
