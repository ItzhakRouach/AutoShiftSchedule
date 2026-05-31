'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signUp, type AuthState } from '../actions'
import { Field } from '../_components/Field'

const initialState: AuthState = {}

export default function SignUpPage() {
  const [state, action, pending] = useActionState(signUp, initialState)

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
        }}
      >
        <h1
          style={{
            margin: '0 0 6px',
            fontSize: 26,
            fontWeight: 800,
            textAlign: 'center',
          }}
        >
          מִשְׁמֶרֶת
        </h1>
        <p
          style={{
            margin: '0 0 28px',
            fontSize: 14,
            color: 'var(--text-2)',
            textAlign: 'center',
          }}
        >
          יצירת חשבון חדש
        </p>

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
            autoComplete="new-password"
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
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              border: 'none',
              borderRadius: 'var(--r-pill)',
              padding: '12px 0',
              fontSize: 15,
              fontWeight: 700,
              cursor: pending ? 'not-allowed' : 'pointer',
              opacity: pending ? 0.7 : 1,
              transition: 'opacity .15s',
              fontFamily: 'inherit',
            }}
          >
            {pending ? 'נרשם…' : 'הרשמה'}
          </button>
        </form>

        <p
          style={{
            marginTop: 20,
            fontSize: 13,
            color: 'var(--text-2)',
            textAlign: 'center',
          }}
        >
          כבר יש לך חשבון?{' '}
          <Link
            href="/login"
            style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
          >
            התחברות
          </Link>
        </p>
      </div>
    </main>
  )
}

