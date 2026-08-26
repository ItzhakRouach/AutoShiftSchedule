'use client'

import { useState } from 'react'
import Link from 'next/link'
import { addDaysISO, formatHebDate } from '@/lib/dates/week'

/** Explains why the editor jumped forward: the previous week was published and
 *  the editing week auto-rolled to the next one. Links back to the published
 *  week's live view (unpublish / manual edits) and is dismissible. */
export function RolledWeekBanner({
  skipped,
}: {
  skipped?: { periodId: string; weekStart: string } | null
}) {
  const [dismissed, setDismissed] = useState(false)
  if (!skipped || dismissed) return null
  const label = `${formatHebDate(skipped.weekStart)} – ${formatHebDate(addDaysISO(skipped.weekStart, 6))}`
  return (
    <div
      data-testid="rolled-week-banner"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '9px 14px', borderRadius: 'var(--r-md)', marginBottom: 14,
        background: 'var(--accent-soft)', fontSize: 13, fontWeight: 600, color: 'var(--text)',
      }}
    >
      <span>הסידור לשבוע {label} פורסם — כעת עורכים את השבוע הבא.</span>
      <Link href={`/schedule?w=${skipped.periodId}`} style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
        לשבוע שפורסם
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="סגירת ההודעה"
        style={{
          marginInlineStart: 'auto', border: 'none', background: 'none', cursor: 'pointer',
          color: 'var(--text-2)', fontSize: 14, fontWeight: 700, padding: 2, fontFamily: 'var(--font)',
        }}
      >
        ✕
      </button>
    </div>
  )
}
