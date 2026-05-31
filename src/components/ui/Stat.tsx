import React from 'react'

interface StatProps {
  value: string | number
  label: string
  sub?: string
  color?: string
  icon?: React.ReactNode
}

export function Stat({ value, label, sub, color, icon }: StatProps) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {icon && (
        <div style={{ marginBottom: 7, color: color ?? 'var(--accent)' }}>{icon}</div>
      )}
      <div
        style={{
          fontSize: 25,
          fontWeight: 800,
          color: 'var(--text)',
          letterSpacing: '-0.8px',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4, fontWeight: 500 }}>
        {label}
      </div>
      {sub && (
        <div
          style={{ fontSize: 11.5, color: color ?? 'var(--text-3)', marginTop: 2, fontWeight: 600 }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}
