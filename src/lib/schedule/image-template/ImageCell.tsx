/**
 * One day cell in the schedule PNG — mirrors WeekTableCell/CellEntryChip.
 * Satori: flexbox only, every node display:flex, Hebrew pre-reordered via
 * toVisualHebrew (h); ASCII time strings rendered raw (never reordered).
 */
import { toVisualHebrew as h } from '@/lib/schedule/bidi'
import type { ImageCellData } from '@/lib/schedule/image-rows'
import { CELL_PAD_V, ENTRY_GAP } from '@/lib/schedule/image-rows'
import { ACCENT, TEXT_3 } from './consts'

interface Props {
  cell: ImageCellData
  background: string
  /** Vertical 3px dark rule on the visual-left edge (skipped on the last day). */
  showLeftRule: boolean
}

export function ImageCell({ cell, background, showLeftRule }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ENTRY_GAP,
        padding: `${CELL_PAD_V}px 6px`,
        background,
        // Satori crashes on undefined style values — add keys conditionally.
        ...(showLeftRule ? { borderLeft: '3px solid #13161D' } : {}),
      }}
    >
      {cell.entries.map((en, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              color: en.color,
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: 'nowrap',
            }}
          >
            {h(en.name)}
          </div>
          {en.is12h && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ display: 'flex', color: ACCENT, fontWeight: 800, fontSize: 11 }}>
                {h(en.variantName ?? '12ש׳')}
              </span>
              {en.variantTime && (
                <span style={{ display: 'flex', color: TEXT_3, fontWeight: 600, fontSize: 9.5 }}>
                  {en.variantTime}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
      {cell.entries.length === 0 && cell.covered && (
        <div style={{ display: 'flex', color: TEXT_3, fontWeight: 700, fontSize: 11 }}>
          {h('12ש׳')}
        </div>
      )}
    </div>
  )
}
