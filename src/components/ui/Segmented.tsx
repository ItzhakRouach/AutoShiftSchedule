'use client'

import React from 'react'

interface SegmentedOption {
  value: string
  label: string
}

interface SegmentedProps {
  options: (string | SegmentedOption)[]
  value: string
  onChange: (value: string) => void
}

export function Segmented({ options, value, onChange }: SegmentedProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 3,
        padding: 3,
        background: 'var(--surface-sunk)',
        borderRadius: 'var(--r-pill)',
      }}
    >
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value
        const lbl = typeof o === 'string' ? o : o.label
        const on = val === value
        return (
          <button
            key={val}
            onClick={() => onChange(val)}
            style={{
              flex: 1,
              padding: '7px 4px',
              fontFamily: 'var(--font)',
              fontSize: 13.5,
              fontWeight: 600,
              border: 'none',
              borderRadius: 'var(--r-pill)',
              cursor: 'pointer',
              background: on ? 'var(--surface)' : 'transparent',
              color: on ? 'var(--text)' : 'var(--text-2)',
              boxShadow: on ? 'var(--shadow)' : 'none',
              transition: 'all .15s ease',
            }}
          >
            {lbl}
          </button>
        )
      })}
    </div>
  )
}
