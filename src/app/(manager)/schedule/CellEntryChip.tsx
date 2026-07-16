'use client'

import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import { LtrText } from '@/components/ui/LtrText'
import { TempChip } from './TempChip'
import { DND_MIME, SRC_MIME, type SrcSlot } from './dnd'
import type { CellEntry } from '@/lib/schedule/week-table-data'

function Badge() {
  return (
    <span title="ביקש משמרת זו" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 9, fontWeight: 800, marginInlineEnd: 3, flexShrink: 0, cursor: 'help' }}>
      ✓
    </span>
  )
}

interface Props {
  entry: CellEntry
  emp?: { name: string; color: string }
  dimmed: boolean
  /** Cell coordinates — written into the drag payload so a drop elsewhere can
   *  swap/move instead of plain-assign. Absent on read-only views. */
  srcSlot?: SrcSlot
  onDragEmployee?: (employeeId: string) => void
  onRemoveTemp?: (assignmentId: string) => void
  /** When set (over-capacity cleanup), renders a small × that unassigns. */
  onRemoveEmployee?: (employeeId: string) => void
}

/** One occupant chip inside a week-table cell: temp chip, or a draggable
 *  worker name with the ✓ requested badge and the 12h variant label. */
export function CellEntryChip({ entry: en, emp, dimmed, srcSlot, onDragEmployee, onRemoveTemp, onRemoveEmployee }: Props) {
  if (en.tempName != null) {
    return <TempChip name={en.tempName} assignmentId={en.assignmentId ?? ''} onRemove={onRemoveTemp} variant="plain" />
  }
  return (
    <span
      draggable={!!onDragEmployee}
      onDragStart={onDragEmployee ? (ev) => {
        ev.dataTransfer.setData(DND_MIME, en.employeeId)
        // Swap/move payload only for plain base entries — a 12h drag keeps the
        // legacy assign behavior (its cells are managed via the 12h editors).
        if (srcSlot && !en.is12h) ev.dataTransfer.setData(SRC_MIME, JSON.stringify(srcSlot))
        ev.dataTransfer.effectAllowed = 'move'
        onDragEmployee(en.employeeId)
      } : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: emp?.color ?? 'var(--text)', fontWeight: 700,
        // Wrap instead of nowrap: with the fixed-width table the cell can't
        // grow, so long names + the 12h label fold to a second line.
        flexWrap: 'wrap', whiteSpace: 'normal', fontSize: 13, lineHeight: 1.4,
        cursor: onDragEmployee ? 'grab' : undefined,
        opacity: dimmed ? 0.35 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {en.requested && <Badge />}
      {emp?.name ?? '?'}
      {en.is12h && (() => {
        const meta = en.variant ? SHIFT_META[en.variant as ShiftId] : undefined
        const name = meta?.name ?? '12ש׳'
        const time = meta?.time
        return (
          <span title={time ? `${name} ${time}` : name} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, marginInlineStart: 3 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 11 }}>{name}</span>
            {time && <LtrText style={{ color: 'var(--text-3)', fontWeight: 600, fontSize: 9.5 }}>{time}</LtrText>}
          </span>
        )
      })()}
      {onRemoveEmployee && (
        <button
          type="button"
          title="הסר מהמשמרת"
          aria-label={`הסר את ${emp?.name ?? 'העובד'} מהמשמרת`}
          onClick={(e) => { e.stopPropagation(); onRemoveEmployee(en.employeeId) }}
          style={{ border: 'none', background: 'transparent', color: 'var(--danger)', fontWeight: 800, fontSize: 12, cursor: 'pointer', padding: '0 2px', marginInlineStart: 2, lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </span>
  )
}
