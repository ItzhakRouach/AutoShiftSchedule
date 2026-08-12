'use client'

import React from 'react'

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

/** Shabbat + holiday observance — SEPARATE, fully independent flags (the
 *  engine blocks them independently, and no checkbox ever changes the other). */
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
        onChange={onShabbat}
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
