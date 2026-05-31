'use client'

import React, { useActionState } from 'react'
import type { JoinState } from './actions'

interface JoinFormProps {
  action: (prevState: JoinState, formData: FormData) => Promise<JoinState>
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 'var(--r-md)',
  border: '1.5px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  fontSize: 15,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
  direction: 'ltr',
}

const errorStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: '#D8423B',
  marginTop: 4,
}

export function JoinForm({ action }: JoinFormProps) {
  const [state, formAction, isPending] = useActionState<JoinState, FormData>(action, {})

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {state.error && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            background: 'rgba(220,70,70,0.1)',
            color: '#D8423B',
            fontSize: 14,
          }}
        >
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="name" style={labelStyle}>שם מלא</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          style={inputStyle}
          dir="rtl"
        />
        {state.fieldErrors?.name && (
          <span style={errorStyle}>{state.fieldErrors.name}</span>
        )}
      </div>

      <div>
        <label htmlFor="email" style={labelStyle}>אימייל</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          style={inputStyle}
        />
        {state.fieldErrors?.email && (
          <span style={errorStyle}>{state.fieldErrors.email}</span>
        )}
      </div>

      <div>
        <label htmlFor="password" style={labelStyle}>סיסמה</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          style={inputStyle}
        />
        {state.fieldErrors?.password && (
          <span style={errorStyle}>{state.fieldErrors.password}</span>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        style={{
          marginTop: 8,
          padding: '14px 20px',
          borderRadius: 'var(--r-pill)',
          border: '1px solid transparent',
          background: 'var(--accent)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 16,
          cursor: isPending ? 'default' : 'pointer',
          opacity: isPending ? 0.55 : 1,
          fontFamily: 'inherit',
          boxShadow: '0 4px 14px var(--accent-soft)',
        }}
      >
        {isPending ? 'מצטרף...' : 'הצטרפות'}
      </button>
    </form>
  )
}
