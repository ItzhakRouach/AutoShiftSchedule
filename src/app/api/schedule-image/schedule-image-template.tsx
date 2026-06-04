import type { ImageGrid } from '@/lib/schedule/image-data'
import { BASE_SHIFTS, SHIFT_NAMES } from '@/lib/schedule/image-data'
import { toVisualHebrew as h } from '@/lib/schedule/bidi'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

const SHIFT_COLORS: Record<string, string> = {
  morning: '#F2A93B',
  noon: '#EB6A4E',
  night: '#5B61D6',
}

const SHIFT_SOFT: Record<string, string> = {
  morning: 'rgba(242,169,59,0.15)',
  noon: 'rgba(235,106,78,0.15)',
  night: 'rgba(91,97,214,0.18)',
}

interface TemplateProps {
  workplaceName: string
  weekLabel: string  // e.g. "31.5 – 6.6.2026"
  /** day dates: 7-item array of short date strings e.g. ["31.5","1.6",...] */
  dayDates: string[]
  grid: ImageGrid
}

export function ScheduleImageTemplate({ workplaceName, weekLabel, dayDates, grid }: TemplateProps) {
  const W = 1200
  const H = 800
  const HEADER_H = 90
  const COL_LABEL_W = 100  // shift label column (rightmost in RTL)
  const DAY_W = Math.floor((W - COL_LABEL_W) / 7)

  // Days ordered right-to-left (Sunday=0 is on the right in RTL)
  // In flex-row with direction:rtl, index 0 appears on the right side automatically
  const dayIndices = [0, 1, 2, 3, 4, 5, 6]

  return (
    <div
      style={{
        width: W, height: H,
        background: '#F7F8FC',
        fontFamily: 'Heb',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        height: HEADER_H, background: '#4F46E5',
        display: 'flex', alignItems: 'center',
        padding: '0 28px', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: '#fff' }}>{h(workplaceName)}</span>
          <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', marginTop: 2 }}>{h(`סידור שבועי · ${weekLabel}`)}</span>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>AutoShift</div>
      </div>

      {/* Day headers row */}
      <div style={{ display: 'flex', flexDirection: 'row', background: '#ECEEF6', borderBottom: '1.5px solid #D5D8E8' }}>
        {/* shift-label placeholder */}
        <div style={{ width: COL_LABEL_W, flexShrink: 0 }} />
        {dayIndices.map((d) => (
          <div
            key={d}
            style={{
              width: DAY_W, flexShrink: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', padding: '10px 4px 8px',
              borderRight: '1px solid #D5D8E8',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1E2140' }}>{h(DAY_NAMES[d])}</span>
            <span style={{ fontSize: 12, color: '#6B7299', marginTop: 2 }}>{dayDates[d]}</span>
          </div>
        ))}
      </div>

      {/* Shift rows */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {BASE_SHIFTS.map((sk) => {
          const shiftH = Math.floor((H - HEADER_H - 48) / 3)
          return (
            <div
              key={sk}
              style={{
                display: 'flex', flexDirection: 'row',
                height: shiftH, borderBottom: '1px solid #D5D8E8',
              }}
            >
              {/* Shift label */}
              <div style={{
                width: COL_LABEL_W, flexShrink: 0,
                background: SHIFT_SOFT[sk],
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                borderLeft: `3px solid ${SHIFT_COLORS[sk]}`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: SHIFT_COLORS[sk] }}>{h(SHIFT_NAMES[sk])}</span>
              </div>
              {/* Day cells */}
              {dayIndices.map((d) => {
                const cell = grid[d]?.[sk]
                const names = cell?.employeeNames ?? []
                const unfilled = cell?.unfilled ?? false
                return (
                  <div
                    key={d}
                    style={{
                      width: DAY_W, flexShrink: 0,
                      display: 'flex', flexDirection: 'column',
                      padding: '6px 5px',
                      borderRight: '1px solid #D5D8E8',
                      background: unfilled && names.length === 0 ? 'rgba(235,106,78,0.06)' : '#fff',
                    }}
                  >
                    {names.map((n, i) => (
                      <div key={i} style={{
                        fontSize: 12, fontWeight: 600,
                        color: '#1E2140',
                        background: SHIFT_SOFT[sk],
                        borderRadius: 5, padding: '2px 5px',
                        marginBottom: 3, lineHeight: 1.3,
                        display: 'flex',
                      }}>
                        {h(n)}
                      </div>
                    ))}
                    {unfilled && (
                      <div style={{
                        fontSize: 11, color: '#EB6A4E',
                        fontWeight: 600, opacity: 0.7, marginTop: 1,
                        display: 'flex',
                      }}>
                        {names.length === 0 ? h('⚠ חסר') : '⚠'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
