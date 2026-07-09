'use client'

import { memo } from 'react'
import type { CellEntry } from '@/lib/schedule/week-table-data'
import { CellEntryChip } from './CellEntryChip'
import { readDragPayload, type SrcSlot } from './dnd'

export type { CellEntry }

const S = {
  base: {
    padding: '10px 12px', verticalAlign: 'middle',
    borderLeft: '3px solid var(--text)', borderBottom: '1px solid var(--border)',
    fontSize: 13, textAlign: 'center', minWidth: 96,
  } as React.CSSProperties,
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
  /** This cell's own dispatch is in flight — dims + blocks taps/drops. */
  isBusy?: boolean
  /** A worker chip was dropped here (src present when dragged from a cell). */
  onDropEmployee?: (employeeId: string, src?: SrcSlot) => void
  /** Begin dragging an already-assigned worker out of this cell. */
  onDragEmployee?: (employeeId: string) => void
  /** Remove an ad-hoc temp entry by its assignment id. */
  onRemoveTemp?: (assignmentId: string) => void
  /** Over-capacity cleanup: renders an × per name that unassigns the worker. */
  onRemoveEmployee?: (employeeId: string) => void
  /** "X/Y" capacity readout (manager-only, edit mode) — blank hides the badge. */
  capacityLabel?: string
  /** Badge renders ONLY for 'under'/'over' — 'full'/'unconfigured' show none. */
  capacityStatus?: 'under' | 'full' | 'over' | 'unconfigured'
  /** SR label "<day>, <shift>, <role>: <names|לא מאויש>" — composed in WeekTable. */
  cellLabel: string
  /** First role-row of a shift group → thick top divider across the row. */
  topDivider?: boolean
  /** Held palette worker already works this day → cell greys, taps ignored. */
  heldBlocked?: boolean
  /** Occupant rest/over-max conflict → red inset ring + tooltip. */
  conflictReason?: 'rest' | 'overmax'
  conflictTitle?: string
  /** This cell's coordinates — carried in drag payloads to enable drag-swap. */
  srcSlot?: SrcSlot
}

/**
 * Single day×shift×role cell. Memoized so that mutating ONE cell in the table
 * doesn't re-render every sibling — `entries` is a stable reference per render
 * of the parent (built once in WeekTable via `useMemo`).
 */
function WeekTableCellImpl(props: WeekTableCellProps) {
  const { entries, empById, isFilled, covered, selectedId, onClick, showUnfilled } = props
  const { isPending, isBusy, onDropEmployee, onDragEmployee, onRemoveTemp, onRemoveEmployee } = props
  const { capacityLabel, capacityStatus, cellLabel, topDivider, heldBlocked } = props
  const { conflictReason, conflictTitle, srcSlot } = props
  const hasSelected = selectedId !== null
  const cellHasSelected = hasSelected && entries.some((e) => e.employeeId === selectedId)
  const empty = entries.length === 0 && !isFilled && !covered
  const bg = empty && showUnfilled
    ? 'color-mix(in srgb, var(--danger) 6%, transparent)'
    : capacityStatus === 'under'
      ? 'var(--warning-soft)'
      : capacityStatus === 'over'
        ? 'var(--danger-soft)'
        : 'var(--surface)'
  const dimCell = hasSelected && !cellHasSelected
  const highlightCell = cellHasSelected || isPending

  const cellStyle: React.CSSProperties = {
    ...S.base,
    background: heldBlocked ? 'var(--surface-2)' : isPending ? 'var(--accent-soft)' : bg,
    cursor: heldBlocked ? 'not-allowed' : onClick ? 'pointer' : 'default',
    opacity: isBusy ? 0.55 : heldBlocked ? 0.4 : dimCell ? 0.4 : 1,
    outline: highlightCell ? '2px solid var(--accent)' : undefined,
    outlineOffset: highlightCell ? '-2px' : undefined,
    borderTop: topDivider ? '3px solid var(--text)' : undefined,
    boxShadow: conflictReason ? 'inset 0 0 0 2px var(--danger)' : undefined,
    transition: 'opacity 0.15s, outline 0.15s, background 0.15s',
  }

  const showBadge = capacityStatus === 'under' || capacityStatus === 'over'
  const capacityBadge = capacityLabel && showBadge && (
    <div style={{ fontSize: 10, color: capacityStatus === 'over' ? 'var(--danger)' : 'var(--text-3)', fontWeight: 600, marginTop: 2 }}>{capacityLabel}</div>
  )

  // While busy, ignore taps/drops on this cell (double-tap / mid-flight guard).
  const clickHandler = isBusy ? undefined : onClick
  const dropTarget = isBusy ? undefined : onDropEmployee

  // Drop target: worker chip from the palette (id only) or another cell (id+src).
  const dropProps = dropTarget
    ? {
        onDragOver: (e: React.DragEvent) => { e.preventDefault() },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault()
          const p = readDragPayload(e)
          if (p) dropTarget(p.employeeId, p.src)
        },
      }
    : {}

  if (entries.length === 0) {
    return (
      <td style={cellStyle} onClick={clickHandler} aria-busy={isBusy || undefined} aria-label={cellLabel} {...dropProps}>
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
  // The × appears only on over-staffed cells (fast cleanup without the editor).
  const removeEmployee = !isBusy && capacityStatus === 'over' ? onRemoveEmployee : undefined
  return (
    <td style={cellStyle} onClick={clickHandler} aria-busy={isBusy || undefined} aria-label={cellLabel} title={conflictTitle} {...dropProps}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map((en, i) => (
          <CellEntryChip
            key={i}
            entry={en}
            emp={empById.get(en.employeeId)}
            dimmed={hasSelected && selectedId !== en.employeeId}
            srcSlot={srcSlot}
            onDragEmployee={dragHandler}
            onRemoveTemp={removeHandler}
            onRemoveEmployee={removeEmployee}
          />
        ))}
      </div>
      {capacityBadge}
    </td>
  )
}

export const WeekTableCell = memo(WeekTableCellImpl)
