'use client'

import { useActionState } from 'react'
import { updatePassword, type AuthState } from '@/app/(auth)/actions'
import { PasswordField } from '@/app/(auth)/_components/PasswordField'

const initialState: AuthState = {}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)', borderRadius: 'var(--r-lg)', padding: '32px 28px',
  width: '100%', maxWidth: 400, direction: 'rtl',
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState)

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={cardStyle}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800 }}>בחירת סיסמה חדשה</h1>
        <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
          הזינו סיסמה חדשה לחשבון שלכם (לפחות 8 תווים).
        </p>

        <form action={action} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PasswordField id="password" label="סיסמה חדשה" name="password" autoComplete="new-password" error={state.fieldErrors?.password} />
          <PasswordField id="passwordConfirm" label="אימות סיסמה חדשה" name="passwordConfirm" autoComplete="new-password" blockPaste error={state.fieldErrors?.passwordConfirm} />

          {state.error && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: '#D4373A', background: 'rgba(212,55,58,0.08)', border: '1px solid rgba(212,55,58,0.2)', borderRadius: 'var(--r-sm)', padding: '8px 12px' }}>
              {state.error}
            </p>
          )}

          <button
            type="submit" disabled={pending}
            style={{
              marginTop: 4, background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 'var(--r-pill)', padding: '13px 0', fontSize: 15, fontWeight: 700,
              cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1, fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(52,87,240,0.3)',
            }}
          >
            {pending ? 'שומר…' : 'עדכון סיסמה'}
          </button>
        </form>
      </div>
    </main>
  )
}
