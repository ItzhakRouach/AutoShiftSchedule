'use client'

import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import type { ScheduleView } from '@/lib/schedule/view-data'

interface Props {
  view: ScheduleView
  selDay: number
}

/** The "משמרות 12 שעות" summary card for the selected day (split out of DayGrid
 *  to keep that file within the ≤200-line budget). Renders nothing when the day
 *  has no 12h assignments. */
export function DayTwelveCard({ view, selDay }: Props) {
  const rows = view.twelve.filter((t) => t.day === selDay)
  if (rows.length === 0) return null
  const empById = new Map(view.employees.map((e) => [e.id, e]))

  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', fontSize: 14, fontWeight: 800 }}>משמרות 12 שעות</div>
      <div style={{ padding: '0 14px 12px', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {rows.map((t, i) => {
          const e = empById.get(t.employeeId)
          return (
            <span
              key={i}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 11px 5px 7px', borderRadius: 99,
                border: '1px solid var(--accent)', background: 'var(--accent-soft)',
              }}
              data-testid="twelve-badge"
            >
              <Avatar name={e?.name ?? '?'} color={e?.color ?? '#888'} size={24} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{e?.name ?? 'לא ידוע'}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>12ש׳</span>
            </span>
          )
        })}
      </div>
    </Card>
  )
}
