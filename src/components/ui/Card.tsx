import React from 'react'

interface CardProps {
  children: React.ReactNode
  style?: React.CSSProperties
  pad?: number
  onClick?: () => void
  /** When true, adds a subtle press scale animation via onMouseDown/Up/Leave */
  interactive?: boolean
  className?: string
}

export function Card({ children, style, pad = 16, onClick, className }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        padding: pad,
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .15s ease, box-shadow .15s ease',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
