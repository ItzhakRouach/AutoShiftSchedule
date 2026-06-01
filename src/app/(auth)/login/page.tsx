'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { signIn, type AuthState } from '../actions'
import { Field } from '../_components/Field'
import { Icon } from '@/components/ui/Icon'

const initialState: AuthState = {}

function LoginForm() {
  const searchParams = useSearchParams()
  const role = searchParams.get('as') === 'employee' ? 'employee' : 'manager'
  const isManager = role === 'manager'

  const [state, action, pending] = useActionState(signIn, initialState)

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          borderRadius: 'var(--r-lg)',
          padding: '32px 28px',
          width: '100%',
          maxWidth: 400,
          direction: 'rtl',
        }}
      >
        {/* Back link */}
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            color: 'var(--text-3)',
            textDecoration: 'none',
            marginBottom: 20,
          }}
        >
          <Icon name="chevronRight" size={14} />
          חזרה לבחירת כניסה
        </Link>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: isManager ? 'var(--accent)' : '#13A98E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: isManager
                ? '0 8px 24px rgba(52,87,240,0.3)'
                : '0 8px 24px rgba(19,169,142,0.3)',
            }}
          >
            <Icon name={isManager ? 'chart' : 'user'} size={28} stroke={1.7} color="#fff" />
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>
            {isManager ? 'כניסת מנהל' : 'כניסת עובד'}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)' }}>
            {isManager ? 'ניהול הסידור והעובדים' : 'הזנת בקשות וצפייה בסידור'}
          </p>
        </div>

        <form action={action} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field
            id="email"
            label="אימייל"
            type="email"
            name="email"
            autoComplete="email"
            error={state.fieldErrors?.email}
          />
          <Field
            id="password"
            label="סיסמה"
            type="password"
            name="password"
            autoComplete="current-password"
            error={state.fieldErrors?.password}
          />

          {state.error && (
            <p
              role="alert"
              style={{
                margin: 0,
                fontSize: 13,
                color: '#D4373A',
                background: 'rgba(212,55,58,0.08)',
                border: '1px solid rgba(212,55,58,0.2)',
                borderRadius: 'var(--r-sm)',
                padding: '8px 12px',
              }}
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{
              marginTop: 4,
              background: isManager ? 'var(--accent)' : '#13A98E',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--r-pill)',
              padding: '13px 0',
              fontSize: 15,
              fontWeight: 700,
              cursor: pending ? 'not-allowed' : 'pointer',
              opacity: pending ? 0.7 : 1,
              transition: 'opacity .15s',
              fontFamily: 'inherit',
              boxShadow: isManager
                ? '0 4px 14px rgba(52,87,240,0.3)'
                : '0 4px 14px rgba(19,169,142,0.3)',
            }}
          >
            {pending ? 'מתחבר…' : 'התחברות'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: 20, fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>
          {isManager ? (
            <p style={{ margin: 0 }}>
              אין לך חשבון?{' '}
              <Link href="/signup" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                הרשמה
              </Link>
            </p>
          ) : (
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              הצטרפת דרך קישור הזמנה? התחבר עם הפרטים שיצרת.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
