import React from 'react'

interface SectionTitleProps {
  children: React.ReactNode
  action?: string
  onAction?: () => void
}

export function SectionTitle({ children, action, onAction }: SectionTitleProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '4px 2px 10px',
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '-0.2px',
        }}
      >
        {children}
      </h3>
      {action && (
        <button
          onClick={onAction}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: 13.5,
            fontWeight: 600,
            fontFamily: 'var(--font)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {action}
        </button>
      )}
    </div>
  )
}
