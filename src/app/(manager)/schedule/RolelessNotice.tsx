'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'

interface RolelessNoticeProps {
  /** Active (joined) employees with no role assigned — excluded from scheduling. */
  employees: { id: string; name: string }[]
}

/**
 * Warns the manager that one or more joined employees have no role, so the
 * auto-scheduler and cell-click suggestions silently skip them (they can only
 * be placed by dragging). Links to /team to assign a role. Renders nothing when
 * every employee has a role.
 */
export function RolelessNotice({ employees }: RolelessNoticeProps) {
  const [dismissed, setDismissed] = useState(false)
  if (employees.length === 0 || dismissed) return null

  const many = employees.length > 1
  const names = employees.map((e) => e.name).join(', ')

  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '11px 14px', marginBottom: 14,
        borderRadius: 'var(--r-md)', border: '1px solid rgba(216,66,59,0.35)',
        background: 'rgba(216,66,59,0.1)',
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>
        <Icon name="alert" size={17} color="#D8423B" stroke={2.2} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#D8423B' }}>
          {many ? `${employees.length} עובדים ללא תפקיד — לא ישובצו בסידור` : 'עובד ללא תפקיד — לא ישובץ בסידור'}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2, wordBreak: 'break-word' }}>
          {names}
        </div>
        <Link
          href="/team"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none', marginTop: 4 }}
        >
          הגדרת תפקיד <Icon name="chevronLeft" size={13} />
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="סגור התראה"
        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2, lineHeight: 0 }}
      >
        <Icon name="x" size={15} stroke={2} />
      </button>
    </div>
  )
}
