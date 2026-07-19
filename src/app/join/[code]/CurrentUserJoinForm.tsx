'use client'

import React, { useActionState, useState } from 'react'
import type { JoinState } from './actions'
import { Spinner } from '@/components/ui/Spinner'
import { PhoneInput } from '@/components/ui/PhoneInput'

interface CurrentUserJoinFormProps {
  action: (prevState: JoinState, formData: FormData) => Promise<JoinState>
  workplaceName: string
  initialName?: string
  initialPhone?: string
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
  direction: 'rtl',
}

const errorStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: '#D8423B',
  marginTop: 4,
}

const EMPLOYMENT_OPTIONS = [
  { value: 'full', label: 'משרה מלאה' },
  { value: 'part', label: 'משרה חלקית' },
  { value: 'student', label: 'סטודנט' },
] as const

type EmploymentValue = typeof EMPLOYMENT_OPTIONS[number]['value']

export function CurrentUserJoinForm({ action, workplaceName, initialName, initialPhone }: CurrentUserJoinFormProps) {
  const [state, formAction, isPending] = useActionState<JoinState, FormData>(action, {})
  const [observesShabbat, setObservesShabbat] = useState(false)
  const [employmentType, setEmploymentType] = useState<EmploymentValue>('full')

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

      {/* Info banner: joining with existing account */}
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 'var(--r-md)',
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        אתה מחובר לחשבון קיים. תוכל להצטרף ל{workplaceName} ישירות.
      </div>

      <div>
        <label htmlFor="name" style={labelStyle}>שם מלא</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          defaultValue={initialName}
          required
          style={inputStyle}
          dir="rtl"
        />
        {state.fieldErrors?.name && (
          <span style={errorStyle}>{state.fieldErrors.name}</span>
        )}
      </div>

      <PhoneInput
        initialValue={initialPhone}
        label="טלפון נייד"
        required
        error={state.fieldErrors?.phone}
      />

      {/* Employment type */}
      <div>
        <span style={labelStyle}>סוג משרה</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {EMPLOYMENT_OPTIONS.map((opt) => {
            const active = employmentType === opt.value
            return (
              <label
                key={opt.value}
                style={{
                  flex: 1, textAlign: 'center', padding: '10px 4px',
                  borderRadius: 'var(--r-md)',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: active ? 'var(--accent)' : 'var(--text)',
                  fontWeight: active ? 700 : 400,
                  fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
                }}
              >
                <input
                  type="radio"
                  name="employmentType"
                  value={opt.value}
                  checked={active}
                  onChange={() => setEmploymentType(opt.value)}
                  style={{ display: 'none' }}
                />
                {opt.label}
              </label>
            )
          })}
        </div>
        {state.fieldErrors?.employmentType && (
          <span style={errorStyle}>{state.fieldErrors.employmentType}</span>
        )}
      </div>

      {/* Shabbat / holiday observance */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 'var(--r-md)',
          border: `1.5px solid ${observesShabbat ? 'var(--accent)' : 'var(--border)'}`,
          background: observesShabbat ? 'var(--accent-soft)' : 'var(--surface-2)',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.15s',
        }}
      >
        <input
          type="checkbox"
          name="observesShabbat"
          value="true"
          checked={observesShabbat}
          onChange={(e) => setObservesShabbat(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
        <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
          אני שומר/ת שבת וחג (לא עובד/ת בשבתות וחגים)
        </span>
      </label>

      <button
        type="submit"
        disabled={isPending}
        style={{
          marginTop: 8,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
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
        {isPending && <Spinner size={16} />}
        {isPending ? 'מצטרף...' : 'הצטרפות עם החשבון שלי'}
      </button>
    </form>
  )
}
