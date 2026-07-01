'use client'

import { memo } from 'react'
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import { TempChip } from './TempChip'

const S = {
  base: {
    padding: '10px 12px', verticalAlign: 'middle',
    borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
    fontSize: 13, textAlign: 'center', minWidth: 96,
  } as React.CSSProperties,
}

function Badge() {
  return (
    <span title="ביקש משמרת זו" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 9, fontWeight: 800, marginInlineEnd: 3, flexShrink: 0, cursor: 'help' }}>
      ✓
    </span>
  )
}

export interface CellEntry {
  employeeId: string
  is12h: boolean
  requested: boolean
  /** 12h variant key — for the hour-range label (present only when is12h). */
  variant?: string
  /** Ad-hoc temp worker display name (no roster employee). */
  tempName?: string
  /** Assignment row id — present for temp entries so they can be removed by id. */
  assignmentId?: string
}

export interface WeekTableCellProps {
  entries: CellEntry[]
  empById: Map<string, { name: string; color: string }>
  isFilled: boolean
  /** True when this cell's coverage comes from a 12h shift in an adjacent slot. */
  covered: boolean
  selectedId: string | null
  onClick?: () => void
  showUnfilled: boolean
  /** True when this cell is the pending target for click-to-assign. */
  isPending?: boolean
  /** True when this cell's own dispatch (assign/remove) is in flight — dims the
   *  cell and blocks further taps/drops until the server responds. */
  isBusy?: boolean
  /** A worker chip was dragged onto this cell (employeeId from dataTransfer). */
  onDropEmployee?: (employeeId: string) => void
  /** Begin dragging an already-assigned worker out of this cell. */
  onDragEmployee?: (employeeId: string) => void
  /** Remove an ad-hoc temp entry by its assignment id. */
  onRemoveTemp?: (assignmentId: string) => void
  /** "X/Y" capacity readout (manager-only, edit mode) — blank hides the badge. */
  capacityLabel?: string
  /** 'under' tints the cell with a soft warning; 'full'/'unconfigured' render plain. */
  capacityStatus?: 'under' | 'full' | 'unconfigured'
}

const DND_MIME = 'application/x-employee-id'

/**
 * Single day×shift×role cell. Memoized so that mutating ONE cell in the table
 * doesn't re-render every sibling — `entries` is a stable reference per render
 * of the parent (we build it once in WeekTable via `useMemo`), so React.memo's
 * default shallow equality is enough.
 */
function WeekTableCellImpl(props: WeekTableCellProps) {
  const { entries, empById, isFilled, covered, selectedId, onClick, showUnfilled } = props
  const { isPending, isBusy, onDropEmployee, onDragEmployee, onRemoveTemp } = props
  const { capacityLabel, capacityStatus } = props
  const hasSelected = selectedId !== null
  const cellHasSelected = hasSelected && entries.some((e) => e.employeeId === selectedId)
  const empty = entries.length === 0 && !isFilled && !covered
  // Fully-empty cells keep the existing red "unfilled" tint; a non-empty cell
  // that's still under its required headcount gets a softer warning tint.
  const bg = empty && showUnfilled
    ? 'color-mix(in srgb, var(--danger) 6%, transparent)'
    : capacityStatus === 'under'
      ? 'var(--warning-soft)'
      : 'var(--surface)'
  const dimCell = hasSelected && !cellHasSelected
  const highlightCell = cellHasSelected || isPending

  const cellStyle: React.CSSProperties = {
    ...S.base,
    background: isPending ? 'var(--accent-soft)' : bg,
    cursor: onClick ? 'pointer' : 'default',
    opacity: isBusy ? 0.55 : dimCell ? 0.4 : 1,
    outline: highlightCell ? '2px solid var(--accent)' : undefined,
    outlineOffset: highlightCell ? '-2px' : undefined,
    transition: 'opacity 0.15s, outline 0.15s, background 0.15s',
  }

  const capacityBadge = capacityLabel && (
    <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, marginTop: 2 }}>{capacityLabel}</div>
  )

  // While busy, ignore taps/drops on this cell (double-tap / mid-flight guard).
  const clickHandler = isBusy ? undefined : onClick
  const dropTarget = isBusy ? undefined : onDropEmployee

  // Drop target: accept a worker chip dragged from the palette or another cell.
  const dropProps = dropTarget
    ? {
        onDragOver: (e: React.DragEvent) => { e.preventDefault() },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault()
          const id = e.dataTransfer.getData(DND_MIME)
          if (id) dropTarget(id)
        },
      }
    : {}

  if (entries.length === 0) {
    return (
      <td style={cellStyle} onClick={clickHandler} aria-busy={isBusy || undefined} {...dropProps}>
        {covered ? (
          <span title="מאויש ע״י משמרת 12 שעות" style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 11 }}>12ש׳</span>
        ) : (
          showUnfilled && <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 12 }}>לא מאויש</span>
        )}
      </td>
    )
  }
  const dragHandler = isBusy ? undefined : onDragEmployee
  const removeHandler = isBusy ? undefined : onRemoveTemp
  return (
    <td style={cellStyle} onClick={clickHandler} aria-busy={isBusy || undefined} {...dropProps}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map((en, i) => {
          // Ad-hoc temp worker: distinct dashed chip + remove (×).
          if (en.tempName != null) {
            return <TempChip key={i} name={en.tempName} assignmentId={en.assignmentId ?? ''} onRemove={removeHandler} variant="plain" />
          }
          const emp = empById.get(en.employeeId)
          const isSelected = selectedId === en.employeeId
          return (
            <span
              key={i}
              draggable={!!dragHandler}
              onDragStart={dragHandler ? (ev) => { ev.dataTransfer.setData(DND_MIME, en.employeeId); ev.dataTransfer.effectAllowed = 'move'; dragHandler(en.employeeId) } : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center',
                color: emp?.color ?? 'var(--text)', fontWeight: 700,
                whiteSpace: 'nowrap', fontSize: 13, lineHeight: 1.4,
                cursor: dragHandler ? 'grab' : undefined,
                opacity: hasSelected && !isSelected ? 0.35 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {en.requested && <Badge />}
              {emp?.name ?? '?'}
              {en.is12h && (
                <span
                  title={en.variant ? SHIFT_META[en.variant as ShiftId]?.time : '12 שעות'}
                  style={{ color: 'var(--accent)', fontWeight: 800, marginInlineStart: 3, fontSize: 11 }}
                >
                  {en.variant ? SHIFT_META[en.variant as ShiftId]?.time ?? '12ש׳' : '12ש׳'}
                </span>
              )}
            </span>
          )
        })}
      </div>
      {capacityBadge}
    </td>
  )
}

export const WeekTableCell = memo(WeekTableCellImpl)
