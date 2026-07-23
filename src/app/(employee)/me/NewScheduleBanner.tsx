'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { markScheduleSeen } from './schedule-seen-actions'

/**
 * Shown on /me when a schedule was published that the employee hasn't seen yet
 * (latest published_at > their schedule_seen.seen_at). Tapping through to the
 * schedule marks it seen server-side; the × dismisses + marks seen too.
 */
export function NewScheduleBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [, run] = useTransition()
  if (dismissed) return null

  function dismiss() {
    setDismissed(true)
    run(async () => {
      await markScheduleSeen()
    })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginBottom: 12 }}>
      <Link href="/me/schedule" style={{ textDecoration: 'none', display: 'block', flex: 1 }}>
        <Card
          interactive
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}
        >
          <Icon name="grid" size={20} stroke={1.9} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>סידור חדש פורסם</div>
            <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginTop: 1 }}>הסידור השבועי מעודכן — לחצו לצפייה</div>
          </div>
          <Icon name="chevronLeft" size={17} color="var(--text-3)" />
        </Card>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="סגירה"
        data-testid="dismiss-new-schedule"
        style={{
          flexShrink: 0, width: 40, borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)',
          background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)',
        }}
      >
        <Icon name="x" size={16} stroke={2} />
      </button>
    </div>
  )
}
