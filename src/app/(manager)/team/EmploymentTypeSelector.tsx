'use client'

import React from 'react'
import type { EmploymentType } from '@/lib/validation/employee'

const OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'full', label: 'משרה מלאה' },
  { value: 'part', label: 'משרה חלקית' },
  { value: 'student', label: 'סטודנט' },
]

interface EmploymentTypeSelectorProps {
  value: EmploymentType
  onChange: (v: EmploymentType) => void
}

export function EmploymentTypeSelector({ value, onChange }: EmploymentTypeSelectorProps) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
        סוג העסקה
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
        }}
      >
        {OPTIONS.map((opt) => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              style={{
                padding: '10px 6px',
                borderRadius: 'var(--r-md)',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: active ? 'var(--accent)' : 'var(--text-2)',
                fontSize: 13.5,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                textAlign: 'center',
                transition: 'all .15s ease',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      <input type="hidden" name="employmentType" value={value} />
    </div>
  )
}
