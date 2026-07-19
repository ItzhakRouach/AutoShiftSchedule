'use client'

import React, { useState } from 'react'
import { ISRAELI_MOBILE_PREFIXES, splitLocalPhone } from '@/lib/whatsapp/phone'

interface PhoneInputProps {
  /** Stored phone (local `0…` or E.164 `972…`) used to seed the fields. */
  initialValue?: string | null
  /** Submitted form-field name carrying the combined local digits. */
  name?: string
  label?: string
  error?: string
  required?: boolean
  id?: string
}

const DASH_AFTER = 3 // format the 7-digit subscriber number as XXX-XXXX
const MAX_DIGITS = 7 // prefix (3) + 7 = 10 local digits total

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6,
}
const boxStyle: React.CSSProperties = {
  padding: '12px 14px', fontSize: 15, fontFamily: 'inherit', color: 'var(--text)',
  background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)',
  boxSizing: 'border-box', outline: 'none',
}
const errorStyle: React.CSSProperties = { fontSize: 12.5, color: '#D8423B', marginTop: 4 }

/** Format the raw subscriber digits for display: a dash after the first 3. */
function withDash(digits: string): string {
  return digits.length > DASH_AFTER ? `${digits.slice(0, DASH_AFTER)}-${digits.slice(DASH_AFTER)}` : digits
}

/**
 * Israeli phone input: a mobile-prefix dropdown + a digits-only number field
 * (letters rejected, capped at 7 digits so prefix+number ≤ 10). Submits the
 * combined local number (`0504551558`) via a hidden field the server normalizes.
 */
export function PhoneInput({ initialValue, name = 'phone', label, error, required, id = 'phone' }: PhoneInputProps) {
  const seed = splitLocalPhone(initialValue)
  const [prefix, setPrefix] = useState(seed.prefix || ISRAELI_MOBILE_PREFIXES[0])
  const [digits, setDigits] = useState(seed.rest.slice(0, MAX_DIGITS))

  const known = ISRAELI_MOBILE_PREFIXES as readonly string[]
  // Keep the current prefix selectable even if it isn't a standard mobile one
  // (e.g. seeded/pasted legacy landline), so editing never silently drops it.
  const options = known.includes(prefix) ? known : [prefix, ...known]

  const combined = `${prefix}${digits}` // e.g. 0504551558

  // Accept a full local number pasted/typed into the number field by re-splitting
  // it into prefix + subscriber; otherwise treat the input as the 7-digit part.
  function onNumberChange(raw: string) {
    const d = raw.replace(/\D/g, '')
    if (d.length >= 9) {
      const s = splitLocalPhone(d)
      if (s.prefix) {
        setPrefix(s.prefix)
        setDigits(s.rest.slice(0, MAX_DIGITS))
        return
      }
    }
    setDigits(d.slice(0, MAX_DIGITS))
  }

  return (
    <div>
      {label && (
        <label htmlFor={id} style={labelStyle}>
          {label}{required && <span style={{ color: '#D8423B' }}> *</span>}
        </label>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr' }}>
        <select
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          aria-label="קידומת"
          style={{ ...boxStyle, flexShrink: 0, cursor: 'pointer' }}
        >
          {options.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>-</span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          value={withDash(digits)}
          onChange={(e) => onNumberChange(e.target.value)}
          placeholder="455-1558"
          required={required}
          autoComplete="tel-national"
          style={{ ...boxStyle, flex: 1, minWidth: 0 }}
        />
      </div>
      <input type="hidden" name={name} value={combined} />
      {error && <p style={errorStyle}>{error}</p>}
    </div>
  )
}
