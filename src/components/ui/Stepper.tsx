'use client'

import React from 'react'
import { Icon } from './Icon'

interface StepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export function Stepper({ value, onChange, min = 0, max = 9 }: StepperProps) {
  const decrement = () => onChange(Math.max(min, value - 1))
  const increment = () => onChange(Math.min(max, value + 1))

  const btnStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 99,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button type="button" onClick={decrement} disabled={value <= min} style={btnStyle}>
        <Icon name="minus" size={16} stroke={2.2} />
      </button>
      <span
        style={{
          minWidth: 18,
          textAlign: 'center',
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--text)',
        }}
      >
        {value}
      </span>
      <button type="button" onClick={increment} disabled={value >= max} style={btnStyle}>
        <Icon name="plus" size={16} stroke={2.2} />
      </button>
    </div>
  )
}
