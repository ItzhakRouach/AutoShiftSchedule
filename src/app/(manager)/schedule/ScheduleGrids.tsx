'use client'

import { useState } from 'react'
import { Segmented } from '@/components/ui/Segmented'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { SlotCtx } from './SwapEditor'
import type { CellAssign } from './useCellAssign'
import { WeekTable } from './WeekTable'
import { DayGrid } from './DayGrid'

const DAY_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
const LAYOUT_OPTIONS = [
  { value: 'week', label: 'שבוע' },
  { value: 'day', label: 'יום' },
]

interface Props {
  view: ScheduleView
  onSlot?: (slot: SlotCtx) => void
  onDayPair?: (day: number) => void
  /** Fast drag / tap-to-assign interactions (edit mode only). */
  assign?: CellAssign
  /** Manager edit metadata — enables inline conflict flags + coverage heatmap. */
  editMeta?: EditMeta | null
  /** Employee viewing their OWN schedule — their shifts are highlighted. */
  selfId?: string
  /** Initial mobile layout. Employees default to 'day'; managers stay 'week'.
   *  Desktop always shows the week table regardless of this. */
  defaultLayout?: 'week' | 'day'
}

/**
 * Responsive schedule body. On desktop (≥1024px) the full week table always
 * shows. On mobile a segmented control switches between the (scrollable) week
 * table and a per-day card view (DayGrid) that's far more legible on a phone.
 * The week table renders ONCE — CSS classes decide where it's visible — so the
 * DOM (and test ids) stay unique.
 */
export function ScheduleGrids({ view, onSlot, onDayPair, assign, editMeta, selfId, defaultLayout = 'week' }: Props) {
  const [layout, setLayout] = useState<'week' | 'day'>(defaultLayout)
  const [selDay, setSelDay] = useState(0)

  return (
    <>
      {/* Week table: always on desktop; on mobile only when 'week' is picked. */}
      <div className={layout === 'week' ? 'sched-week-on' : 'sched-week-deskonly'}>
        <WeekTable view={view} onSlot={onSlot} onDayPair={onDayPair} assign={assign} editMeta={editMeta} initialSelectedId={selfId} />
      </div>

      {/* Mobile-only: layout toggle + (in day mode) a day selector + DayGrid. */}
      <div className="sched-mobile">
        <div style={{ marginBottom: 12 }}>
          <Segmented
            options={LAYOUT_OPTIONS}
            value={layout}
            onChange={(v) => setLayout(v as 'week' | 'day')}
          />
        </div>

        {layout === 'day' && (
          <>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
              {view.days.map((d, i) => {
                const active = i === selDay
                return (
                  <button
                    key={i}
                    onClick={() => setSelDay(i)}
                    aria-pressed={active}
                    style={{
                      flexShrink: 0, minWidth: 48, padding: '8px 6px', borderRadius: 'var(--r-md)',
                      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent-soft)' : 'var(--surface)',
                      color: active ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 800 }}>{DAY_SHORT[i]}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.85 }}>{d.date}</span>
                  </button>
                )
              })}
            </div>
            <DayGrid view={view} selDay={selDay} onSlot={onSlot} assign={assign} selfId={selfId} />
          </>
        )}
      </div>
    </>
  )
}
