'use client'

import { useActionState } from 'react'
import { createWorkplace, type WorkplaceState } from './actions'
import { signOut } from '@/app/(auth)/actions'

function Field({
  id,
  label,
  name,
  error,
  placeholder,
}: {
  id: string
  label: string
  name: string
  error?: string
  placeholder?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        placeholder={placeholder}
        aria-invalid={!!error}
        style={{
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: `1px solid ${error ? '#D4373A' : 'var(--border-strong)'}`,
          borderRadius: 'var(--r-sm)',
          padding: '10px 12px',
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
          direction: 'rtl',
          textAlign: 'right',
          transition: 'box-shadow .15s, border-color .15s',
        }}
        onFocus={e => {
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-soft)'
          e.currentTarget.style.borderColor = 'var(--accent)'
        }}
        onBlur={e => {
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.borderColor = error ? '#D4373A' : 'var(--border-strong)'
        }}
      />
      {error && (
        <span role="alert" style={{ fontSize: 12, color: '#D4373A' }}>
          {error}
        </span>
      )}
    </div>
  )
}

const initialState: WorkplaceState = {}

export default function OnboardingPage() {
  const [state, formAction, isPending] = useActionState(createWorkplace, initialState)

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          borderRadius: 'var(--r-lg)',
          padding: 32,
          maxWidth: 480,
          width: '100%',
          direction: 'rtl',
        }}
      >
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, textAlign: 'right' }}>
          הקמת מקום עבודה
        </h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-2)', fontSize: 13, textAlign: 'right' }}>
          מלאו את הפרטים הבאים — תפקידים, סוגי משמרת והגדרות ברירת מחדל ייווצרו אוטומטית.
        </p>

        {state.error && (
          <div
            role="alert"
            style={{
              background: 'rgba(212,55,58,0.1)',
              border: '1px solid #D4373A',
              borderRadius: 'var(--r-sm)',
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: 13,
              color: '#D4373A',
              textAlign: 'right',
            }}
          >
            {state.error}
          </div>
        )}

        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field
            id="orgName"
            name="orgName"
            label="שם הארגון"
            error={state.fieldErrors?.orgName}
            placeholder="לדוגמה: חברת הביטחון שלי"
          />
          <Field
            id="workplaceName"
            name="workplaceName"
            label="שם מקום העבודה"
            error={state.fieldErrors?.workplaceName}
            placeholder="לדוגמה: סניף תל אביב"
          />

          <button
            type="submit"
            disabled={isPending}
            style={{
              marginTop: 8,
              background: isPending ? 'var(--surface-2)' : 'var(--accent)',
              color: isPending ? 'var(--text-2)' : '#fff',
              border: 'none',
              borderRadius: 'var(--r-pill)',
              padding: '12px 24px',
              fontSize: 15,
              fontWeight: 700,
              cursor: isPending ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background .15s',
            }}
          >
            {isPending ? 'יוצר...' : 'יצירת מקום עבודה'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <form action={signOut} style={{ display: 'inline' }}>
            <button
              type="submit"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-3)',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textDecoration: 'underline',
              }}
            >
              יציאה
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
