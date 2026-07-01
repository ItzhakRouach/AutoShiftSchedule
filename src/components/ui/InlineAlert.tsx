'use client'

import React from 'react'

type AlertKind = 'success' | 'warning' | 'error' | 'info'

interface InlineAlertProps {
  kind: AlertKind
  children: React.ReactNode
  style?: React.CSSProperties
}

const KIND_VARS: Record<AlertKind, { bg: string; fg: string }> = {
  success: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  error: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  info: { bg: 'var(--accent-soft)', fg: 'var(--text)' },
}

/** Shared inline feedback strip (success/warning/error/info) for sheets and
 *  forms — the single place message styling lives, so it stays consistent. */
export function InlineAlert({ kind, children, style }: InlineAlertProps) {
  const { bg, fg } = KIND_VARS[kind]
  return (
    <div
      role="status"
      style={{
        padding: '9px 12px',
        borderRadius: 12,
        background: bg,
        color: fg,
        fontSize: 13,
        marginBottom: 12,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
