import React from 'react'

/**
 * Shown after a wrong-screen login is blocked and the user is redirected to the
 * screen that matches their account role (`?switched=1`). `screen` is the
 * now-correct screen they were sent to.
 */
export function RoleMismatchNotice({ screen }: { screen: 'manager' | 'employee' }) {
  const text =
    screen === 'employee'
      ? 'החשבון שלך רשום כעובד. התחבר/י כאן.'
      : 'החשבון שלך רשום כמנהל. התחבר/י כאן.'

  return (
    <p
      role="status"
      style={{
        margin: '0 0 4px',
        fontSize: 13,
        color: 'var(--text)',
        background: 'rgba(224,144,42,0.12)',
        border: '1px solid rgba(224,144,42,0.35)',
        borderRadius: 'var(--r-sm)',
        padding: '9px 12px',
        lineHeight: 1.5,
      }}
    >
      {text}
    </p>
  )
}
