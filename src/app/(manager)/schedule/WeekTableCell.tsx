'use client'

import { memo } from 'react'

const S = {
  base: {
    padding: '10px 12px', verticalAlign: 'middle',
    borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
    fontSize: 13, textAlign: 'center', minWidth: 96,
  } as React.CSSProperties,
}

function Badge() {
  return (
    <span title="ביקש משמרת זו" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: 'rgba(19,169,142,0.18)', color: '#13A98E', fontSize: 9, fontWeight: 800, marginRight: 3, flexShrink: 0, cursor: 'help' }}>
      ✓
    </span>
  )
}

export interface CellEntry {
  employeeId: string
  is12h: boolean
  requested: boolean
}

export interface WeekTableCellProps {
  entries: CellEntry[]
  empById: Map<string, { name: string; color: string }>
  isFilled: boolean
  /** True when this cell's coverage comes from a 12h shift in an adjacent slot. */
  covered: boolean
  selectedId: string | null
  onClick?: () => void
  onSelectEmp: (id: string) => void
  showUnfilled: boolean
}

/**
 * Single day×shift×role cell. Memoized so that mutating ONE cell in the table
 * doesn't re-render every sibling — `entries` is a stable reference per render
 * of the parent (we build it once in WeekTable via `useMemo`), so React.memo's
 * default shallow equality is enough.
 */
function WeekTableCellImpl(props: WeekTableCellProps) {
  const { entries, empById, isFilled, covered, selectedId, onClick, onSelectEmp, showUnfilled } = props
  const hasSelected = selectedId !== null
  const cellHasSelected = hasSelected && entries.some((e) => e.employeeId === selectedId)
  const bg = entries.length === 0 && !isFilled && !covered && showUnfilled ? 'rgba(235,106,78,0.06)' : 'var(--surface)'
  const dimCell = hasSelected && !cellHasSelected
  const highlightCell = cellHasSelected

  const cellStyle: React.CSSProperties = {
    ...S.base,
    background: bg,
    cursor: onClick ? 'pointer' : 'default',
    opacity: dimCell ? 0.4 : 1,
    outline: highlightCell ? '2px solid var(--accent, #13A98E)' : undefined,
    outlineOffset: highlightCell ? '-2px' : undefined,
    transition: 'opacity 0.15s, outline 0.15s',
  }

  if (entries.length === 0) {
    return (
      <td style={cellStyle} onClick={onClick}>
        {covered ? (
          <span title="מאויש ע״י משמרת 12 שעות" style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 11 }}>12ש׳</span>
        ) : (
          showUnfilled && <span style={{ color: '#EB6A4E', fontWeight: 600, fontSize: 12 }}>לא מאויש</span>
        )}
      </td>
    )
  }
  return (
    <td style={cellStyle} onClick={onClick}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map((en, i) => {
          const emp = empById.get(en.employeeId)
          const isSelected = selectedId === en.employeeId
          return (
            <span
              key={i}
              role="button"
              aria-pressed={isSelected}
              title={isSelected ? 'לחץ לביטול הסימון' : 'לחץ לסימון עובד'}
              onClick={(ev) => { ev.stopPropagation(); onSelectEmp(en.employeeId) }}
              style={{
                display: 'inline-flex', alignItems: 'center',
                color: emp?.color ?? 'var(--text)', fontWeight: 700,
                whiteSpace: 'nowrap', fontSize: 13, lineHeight: 1.4,
                cursor: 'pointer',
                opacity: hasSelected && !isSelected ? 0.35 : 1,
                textDecoration: isSelected ? 'underline' : undefined,
                transition: 'opacity 0.15s',
              }}
            >
              {en.requested && <Badge />}
              {emp?.name ?? '?'}
              {en.is12h ? <span style={{ color: 'var(--accent)', fontWeight: 800, marginRight: 2 }}>-12</span> : ''}
            </span>
          )
        })}
      </div>
    </td>
  )
}

export const WeekTableCell = memo(WeekTableCellImpl)
