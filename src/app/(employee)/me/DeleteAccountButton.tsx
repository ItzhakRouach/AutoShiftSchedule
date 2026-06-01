'use client'

import { useState, useTransition } from 'react'
import { deleteMyAccount } from './actions'

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deleteMyAccount()
      if (result?.error) setError(result.error)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--danger, #DC2626)',
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 0,
          marginTop: 12,
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
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 24,
          }}
        >
          <div
            style={{
              background: 'var(--surface, #fff)',
              borderRadius: 'var(--r-lg, 16px)',
              padding: '28px 24px',
              maxWidth: 360,
              width: '100%',
              direction: 'rtl',
              textAlign: 'right',
            }}
          >
            <h2
              id="delete-dlg-title"
              style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}
            >
              מחיקת חשבון
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
              פעולה זו תמחק את חשבונך והנתונים שלך לצמיתות. לא ניתן לבטל פעולה זו.
            </p>
            {error && (
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--danger, #DC2626)', fontWeight: 600 }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-start' }}>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                style={{
                  background: 'var(--danger, #DC2626)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--r-md, 10px)',
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: isPending ? 0.7 : 1,
                }}
              >
                {isPending ? 'מוחק...' : 'מחיקה סופית'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null) }}
                disabled={isPending}
                style={{
                  background: 'var(--surface-raised, #F3F4F6)',
                  color: 'var(--text)',
                  border: 'none',
                  borderRadius: 'var(--r-md, 10px)',
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
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
