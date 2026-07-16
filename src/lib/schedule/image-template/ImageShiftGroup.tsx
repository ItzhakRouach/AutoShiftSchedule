/**
 * One shift group (בוקר/צהריים/לילה) — emulates the table's rowSpan: the shift
 * label column spans the group's full height next to a stack of role rows.
 */
import { toVisualHebrew as h } from '@/lib/schedule/bidi'
import type { ImageShiftGroup as GroupData } from '@/lib/schedule/image-rows'
import { ImageCell } from './ImageCell'
import { COL_DIVIDER, ROLE_W, SHIFT_W, SURFACE, TEXT, TEXT_2, ZEBRA_ODD, flatten16, zebraTint } from './consts'

interface Props {
  group: GroupData
  /** 3px dark top divider between shift groups (not above the first). */
  showTopDivider: boolean
}

export function ImageShiftGroup({ group, showTopDivider }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        ...(showTopDivider ? { borderTop: `${COL_DIVIDER}px solid ${TEXT}` } : {}),
      }}
    >
      {/* Shift label — spans all role rows (explicit height from image-rows). */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: SHIFT_W,
          height: group.height,
          flexShrink: 0,
          background: flatten16(group.color),
        }}
      >
        <div style={{ display: 'flex', color: group.color, fontWeight: 800, fontSize: 13 }}>
          {h(group.name)}
        </div>
        <div style={{ display: 'flex', color: TEXT_2, fontWeight: 600, fontSize: 11, marginTop: 3 }}>
          {group.time}
        </div>
      </div>

      {/* Role rows */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {group.rows.map((row, ri) => (
          <div
            key={row.roleName}
            style={{
              display: 'flex',
              flexDirection: 'row',
              height: row.height,
              // Row divider is drawn ON TOP of the row (marginTop -1) so the
              // computed heights stay exact: Σ rows === group height.
              ...(ri > 0 ? { borderTop: '1px solid #E6E8EE', marginTop: -1 } : {}),
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                width: ROLE_W,
                flexShrink: 0,
                padding: '0 8px',
                background: row.roleColor ? flatten16(row.roleColor) : SURFACE,
                color: row.roleColor,
                fontWeight: 700,
                fontSize: 12.5,
                borderLeft: `${COL_DIVIDER}px solid ${TEXT}`,
              }}
            >
              {h(row.roleName)}
            </div>
            {row.cells.map((cell, di) => (
              <ImageCell
                key={di}
                cell={cell}
                background={row.zebraEven ? zebraTint(group.color) : ZEBRA_ODD}
                showLeftRule={di < row.cells.length - 1}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
