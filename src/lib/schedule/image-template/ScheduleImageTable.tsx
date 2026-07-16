/**
 * Root Satori template for the schedule PNG — a faithful mirror of the
 * manager week table (WeekTable): header bar, day-header row, then shift
 * groups spanning role rows. RTL flex; Hebrew pre-reordered via h().
 */
import { toVisualHebrew as h } from '@/lib/schedule/bidi'
import type { ImageDoc } from '@/lib/schedule/image-rows'
import { DAY_HEADER_H, FRAME_PAD, HEADER_H } from '@/lib/schedule/image-rows'
import { ImageShiftGroup } from './ImageShiftGroup'
import { BORDER, COL_DIVIDER, FRAME_BG, HEADER_BG, ROLE_W, SHIFT_W, SURFACE, TEXT, TEXT_2, TEXT_3 } from './consts'

export function ScheduleImageTable({ doc }: { doc: ImageDoc }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: FRAME_BG,
        padding: FRAME_PAD,
        fontFamily: 'Heb',
        direction: 'rtl',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: HEADER_H,
          padding: '0 6px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: TEXT, fontWeight: 800, fontSize: 22 }}>
            {h(doc.workplaceName)}
          </div>
          <div style={{ display: 'flex', color: TEXT_2, fontWeight: 600, fontSize: 13, marginTop: 2 }}>
            {h(`סידור שבועי · ${doc.weekLabel}`)}
          </div>
        </div>
        <div style={{ display: 'flex', color: TEXT_3, fontWeight: 700, fontSize: 13 }}>AutoShift</div>
      </div>

      {/* Table frame */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {/* Day header row */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            height: DAY_HEADER_H,
            background: HEADER_BG,
            borderBottom: `${COL_DIVIDER}px solid ${TEXT}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: SHIFT_W, flexShrink: 0, color: TEXT, fontWeight: 700, fontSize: 13 }}>
            {h('משמרת')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: ROLE_W, flexShrink: 0, color: TEXT, fontWeight: 700, fontSize: 13, borderLeft: `${COL_DIVIDER}px solid ${TEXT}` }}>
            {h('תפקיד')}
          </div>
          {doc.days.map((d, di) => (
            <div
              key={d.index}
              style={{
                display: 'flex',
                flex: 1,
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                ...(di < doc.days.length - 1 ? { borderLeft: `${COL_DIVIDER}px solid ${TEXT}` } : {}),
              }}
            >
              <div style={{ display: 'flex', color: TEXT, fontWeight: 800, fontSize: 13 }}>{h(d.short)}</div>
              <div style={{ display: 'flex', color: TEXT_2, fontWeight: 600, fontSize: 11, marginTop: 2 }}>{d.date}</div>
            </div>
          ))}
        </div>

        {/* Shift groups */}
        {doc.groups.map((g, gi) => (
          <ImageShiftGroup key={g.key} group={g} showTopDivider={gi > 0} />
        ))}
      </div>
    </div>
  )
}
