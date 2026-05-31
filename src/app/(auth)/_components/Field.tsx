'use client'

import { useState } from 'react'

export function Field({
  id,
  label,
  type,
  name,
  autoComplete,
  error,
}: {
  id: string
  label: string
  type: string
  name: string
  autoComplete?: string
  error?: string
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: `1px solid ${error ? '#D4373A' : focused ? 'var(--accent)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--r-sm)',
          padding: '10px 12px',
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
          direction: 'ltr',
          textAlign: 'left',
          boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : 'none',
          transition: 'box-shadow .15s, border-color .15s',
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
