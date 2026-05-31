'use client'

import React from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(!checked) }}
      disabled={disabled}
      style={{
        width: 46,
        height: 28,
        borderRadius: 99,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        padding: 3,
        background: checked ? 'var(--accent)' : 'var(--border-strong)',
        transition: 'background .2s ease',
        display: 'flex',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 99,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'all .2s ease',
        }}
      />
    </button>
  )
}
