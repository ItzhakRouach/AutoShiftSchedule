'use client'

import { dayTitle } from '@/lib/domain/days'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { LtrText } from '@/components/ui/LtrText'
import { SHIFT_META } from '@/lib/domain/constants'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { TwelveHourSuggestion } from '@/lib/scheduling/types'

export function DaySelector({
  view,
  selDay,
  setSelDay,
}: {
  view: ScheduleView
  selDay: number
  setSelDay: (d: number) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
      {view.days.map((d) => {
        const on = d.index === selDay
        return (
          <button
            key={d.index}
            onClick={() => setSelDay(d.index)}
            style={{
              flex: '0 0 auto',
              width: 50,
              padding: '9px 0',
              borderRadius: 'var(--r-md)',
              cursor: 'pointer',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
              background: on ? 'var(--accent)' : 'var(--surface)',
              fontFamily: 'var(--font)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: on ? '#fff' : 'var(--text)' }}>{d.short}</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: on ? 'rgba(255,255,255,0.8)' : 'var(--text-3)' }}>
              {d.date}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function TwelveHourList({
  suggestions,
  roles,
}: {
  suggestions: TwelveHourSuggestion[]
  roles: ScheduleView['roles']
}) {
  if (suggestions.length === 0) return null
  const roleById = new Map(roles.map((r) => [r.id, r.name]))
  return (
    <Card style={{ marginTop: 14 }}>
      {/* Collapsed by default: a long week can produce dozens of suggestions. */}
      <details>
        <summary style={{ fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
          הצעות למשמרות 12 שעות ({suggestions.length})
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.4 }}>
              {dayTitle(s.day)} · <LtrText>{SHIFT_META[s.variant]?.time ?? s.variant}</LtrText>
              {roleById.get(s.roleId) ? ` · ${roleById.get(s.roleId)}` : ''}
            </div>
          ))}
        </div>
      </details>
    </Card>
  )
}

export function Generating() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 0',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 70,
          height: 70,
          borderRadius: 22,
          background: 'var(--accent)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="clock" size={34} stroke={1.8} />
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', marginTop: 22 }}>בונה את הסידור…</div>
    </div>
  )
}
