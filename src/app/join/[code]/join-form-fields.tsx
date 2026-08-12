'use client'

// Shared field components + styles for JoinForm / CurrentUserJoinForm.
import React from 'react'
import { Spinner } from '@/components/ui/Spinner'

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 6,
}

export const inputStyle: React.CSSProperties = {
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

export const errorStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: '#D8423B',
  marginTop: 4,
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 'var(--r-md)',
        background: 'rgba(220,70,70,0.1)',
        color: '#D8423B',
        fontSize: 14,
      }}
    >
      {error}
    </div>
  )
}

const EMPLOYMENT_OPTIONS = [
  { value: 'full', label: 'משרה מלאה' },
  { value: 'part', label: 'משרה חלקית' },
  { value: 'student', label: 'סטודנט' },
] as const

export type EmploymentValue = typeof EMPLOYMENT_OPTIONS[number]['value']

export function EmploymentPicker({
  value,
  onChange,
  error,
}: {
  value: EmploymentValue
  onChange: (v: EmploymentValue) => void
  error?: string
}) {
  return (
    <div>
      <span style={labelStyle}>סוג משרה</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {EMPLOYMENT_OPTIONS.map((opt) => {
          const active = value === opt.value
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
                onChange={() => onChange(opt.value)}
                style={{ display: 'none' }}
              />
              {opt.label}
            </label>
          )
        })}
      </div>
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  )
}

function ObservanceCheckbox({
  name,
  checked,
  onChange,
  label,
}: {
  name: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 'var(--r-md)',
        border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
        background: checked ? 'var(--accent-soft)' : 'var(--surface-2)',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.15s',
      }}
    >
      <input
        type="checkbox"
        name={name}
        value="true"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
      <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
    </label>
  )
}

/** Shabbat + holiday observance — SEPARATE flags (the engine blocks them
 *  independently). Checking Shabbat also defaults holidays on, but each stays
 *  individually toggleable. */
export function ObservancePicker({
  shabbat,
  holidays,
  onShabbat,
  onHolidays,
}: {
  shabbat: boolean
  holidays: boolean
  onShabbat: (v: boolean) => void
  onHolidays: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ObservanceCheckbox
        name="observesShabbat"
        checked={shabbat}
        onChange={(v) => {
          onShabbat(v)
          if (v) onHolidays(true)
        }}
        label="אני שומר/ת שבת (לא עובד/ת בשבתות)"
      />
      <ObservanceCheckbox
        name="observesHolidays"
        checked={holidays}
        onChange={onHolidays}
        label="אני שומר/ת חג (לא עובד/ת בחגים)"
      />
    </div>
  )
}

export function JoinSubmitButton({ isPending, label }: { isPending: boolean; label: string }) {
  return (
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
      {isPending ? 'מצטרף...' : label}
    </button>
  )
}
