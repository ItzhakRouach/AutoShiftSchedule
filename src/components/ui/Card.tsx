import React from 'react'

interface CardProps {
  children: React.ReactNode
  style?: React.CSSProperties
  pad?: number
  onClick?: () => void
  /** When true, adds a subtle CSS press-scale animation on :active. */
  interactive?: boolean
  className?: string
}

export function Card({ children, style, pad = 16, onClick, interactive, className }: CardProps) {
  const classes = [interactive ? 'card-interactive' : null, className]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      onClick={onClick}
      className={classes || undefined}
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
