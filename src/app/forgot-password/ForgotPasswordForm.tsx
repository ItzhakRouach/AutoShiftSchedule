'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordReset, type AuthState } from '@/app/(auth)/actions'
import { Field } from '@/app/(auth)/_components/Field'
import { Icon } from '@/components/ui/Icon'

const initialState: AuthState = {}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)', borderRadius: 'var(--r-lg)', padding: '32px 28px',
  width: '100%', maxWidth: 400, direction: 'rtl',
}

export function ForgotPasswordForm({ linkFailed }: { linkFailed: boolean }) {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState)

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={cardStyle}>
        <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-3)', textDecoration: 'none', marginBottom: 20 }}>
          <Icon name="chevronRight" size={14} />
          חזרה להתחברות
        </Link>

        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800 }}>שכחתי סיסמה</h1>
        <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
          הזינו את כתובת האימייל שלכם ונשלח קישור לאיפוס הסיסמה.
        </p>

        {linkFailed && !state.ok && (
          <p role="alert" style={{ margin: '0 0 16px', fontSize: 13, color: '#D4373A', background: 'rgba(212,55,58,0.08)', border: '1px solid rgba(212,55,58,0.2)', borderRadius: 'var(--r-sm)', padding: '10px 12px', lineHeight: 1.5 }}>
          הקישור לאיפוס פג תוקף או שנפתח בדפדפן אחר מזה שביקש אותו. בקשו קישור חדש.
          </p>
        )}

        {state.ok ? (
          <div style={{ fontSize: 14, color: '#13A98E', background: 'rgba(19,169,142,0.1)', border: '1px solid rgba(19,169,142,0.25)', borderRadius: 'var(--r-sm)', padding: '12px 14px', lineHeight: 1.5 }}>
            אם קיים חשבון עם אימייל זה, נשלח אליו קישור לאיפוס הסיסמה. בדקו את תיבת הדואר.
          </div>
        ) : (
          <form action={action} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field id="email" label="אימייל" type="email" name="email" autoComplete="email" error={state.fieldErrors?.email} />
            <button
              type="submit" disabled={pending}
              style={{
                marginTop: 4, background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 'var(--r-pill)', padding: '13px 0', fontSize: 15, fontWeight: 700,
                cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1, fontFamily: 'inherit',
                boxShadow: '0 4px 14px rgba(52,87,240,0.3)',
              }}
            >
              {pending ? 'שולח…' : 'שליחת קישור לאיפוס'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
