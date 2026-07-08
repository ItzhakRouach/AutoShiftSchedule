'use client'

import { useMemo } from 'react'
import { countUncoveredCells } from '@/lib/schedule/week-table-data'
import type { ScheduleView } from '@/lib/schedule/view-data'

interface Props {
  view: ScheduleView
  /** Coverage % from the last generate run (null before a run). */
  pct: number | null
}

/** Page title + at-a-glance week health: a LIVE unfilled-shifts counter (always
 *  accurate, recomputed from the current grid) alongside the generate-time
 *  coverage %. Split out to keep ScheduleClient ≤200 lines. */
export function ScheduleHeader({ view, pct }: Props) {
  const gaps = useMemo(() => countUncoveredCells(view), [view])
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
      <h1 style={{ margin: 0, fontSize: 'var(--text-h1)', fontWeight: 800 }}>סידור עבודה</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          data-testid="live-gaps"
          title={gaps > 0 ? 'משמרות שעדיין חסרות איוש' : 'כל המשמרות הנדרשות מאוישות'}
          style={{
            textAlign: 'center', borderRadius: 'var(--r-md)', padding: '8px 13px',
            background: gaps > 0 ? 'var(--danger-soft)' : 'var(--success-soft)',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, color: gaps > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {gaps > 0 ? gaps : '✓'}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>
            {gaps > 0 ? 'לא מאויש' : 'מלא'}
          </div>
        </div>
        {pct !== null && (
          <div style={{ textAlign: 'center', background: pct >= 95 ? 'rgba(19,169,142,0.12)' : 'rgba(235,106,78,0.12)', borderRadius: 'var(--r-md)', padding: '8px 13px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: pct >= 95 ? '#13A98E' : '#EB6A4E', lineHeight: 1 }} data-testid="coverage">{pct}%</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>כיסוי</div>
          </div>
        )}
      </div>
    </div>
  )
}
