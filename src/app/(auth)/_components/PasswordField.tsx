'use client'

import { useState } from 'react'

interface PasswordFieldProps {
  id: string
  label: string
  name: string
  autoComplete?: string
  error?: string
  /** Block pasting into this field (the confirm field) so the user must
   *  retype rather than copy the first field's value. Copy/cut are blocked
   *  on ALL password fields; paste stays allowed on the primary field so
   *  password managers keep working. */
  blockPaste?: boolean
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  )
}

/** Password input with a show/hide toggle and copy-between-fields guards. */
export function PasswordField({ id, label, name, autoComplete, error, blockPaste }: PasswordFieldProps) {
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)

  const swallow = (e: React.ClipboardEvent) => e.preventDefault()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onCopy={swallow}
          onCut={swallow}
          onPaste={blockPaste ? swallow : undefined}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: `1px solid ${error ? '#D4373A' : focused ? 'var(--accent)' : 'var(--border-strong)'}`,
            borderRadius: 'var(--r-sm)',
            padding: '10px 12px',
            paddingInlineEnd: 42,
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            direction: 'ltr',
            textAlign: 'left',
            boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : 'none',
            transition: 'box-shadow .15s, border-color .15s',
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'הסתר סיסמה' : 'הצג סיסמה'}
          aria-pressed={visible}
          tabIndex={-1}
          style={{
            position: 'absolute',
            insetInlineEnd: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            border: 'none',
            background: 'none',
            color: 'var(--text-3)',
            cursor: 'pointer',
            borderRadius: 8,
          }}
        >
          <EyeIcon off={visible} />
        </button>
      </div>
      {error && (
        <span role="alert" style={{ fontSize: 12, color: '#D4373A' }}>
          {error}
        </span>
      )}
    </div>
  )
}
