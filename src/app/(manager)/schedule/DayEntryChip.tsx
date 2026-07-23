'use client'

import { Avatar } from '@/components/ui/Avatar'
import { LtrText } from '@/components/ui/LtrText'
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import type { CellEntry } from '@/lib/schedule/week-table-data'
import type { ViewEmployee } from '@/lib/schedule/view-data'
import { TempChip } from './TempChip'

interface Props {
  entry: CellEntry
  emp?: ViewEmployee
  isSelf: boolean
  busy: boolean
  /** Opens the 8h slot editor — omitted for 12h entries (managed via day-pair tools). */
  onClick?: () => void
  onRemoveTemp?: (assignmentId: string) => void
}

/** One assignee chip in the mobile day view: roster worker, 12h worker (with
 *  the variant hour-range tag), or ad-hoc temp. Mirrors WeekTable's
 *  CellEntryChip semantics in the day card's pill style. */
export function DayEntryChip({ entry, emp, isSelf, busy, onClick, onRemoveTemp }: Props) {
  if (entry.tempName) {
    return (
      <TempChip
        name={entry.tempName}
        assignmentId={entry.assignmentId ?? ''}
        onRemove={busy ? undefined : onRemoveTemp}
        variant="pill"
      />
    )
  }

  const meta = entry.is12h && entry.variant ? SHIFT_META[entry.variant as ShiftId] : undefined
  const clickable = !!onClick && !busy && !entry.is12h
  return (
    <span
      data-testid={entry.is12h ? 'day-twelve-chip' : undefined}
      onClick={clickable ? onClick : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 11px 5px 7px',
        borderRadius: 99,
        border: `1.5px solid ${isSelf ? 'var(--accent)' : 'var(--border)'}`,
        background: isSelf ? 'var(--accent-soft)' : 'var(--surface-2)',
        cursor: clickable ? 'pointer' : 'default',
        opacity: busy ? 0.55 : 1,
      }}
    >
      <Avatar name={emp?.name ?? '?'} color={emp?.color ?? '#888'} size={24} />
      {entry.requested && (
        <span title="ביקש משמרת זו" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>✓</span>
      )}
      <span style={{ fontSize: 13, fontWeight: isSelf ? 800 : 600, color: isSelf ? 'var(--accent)' : 'var(--text)' }}>
        {emp?.name ?? 'לא ידוע'}{isSelf ? ' (אני)' : ''}
      </span>
      {meta && (
        <span title="משמרת 12 שעות" style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '1px 6px', flexShrink: 0 }}>
          12ש׳ <LtrText>{meta.time}</LtrText>
        </span>
      )}
    </span>
  )
}

/** Marker for a slot that has no chip but is covered by a 12h shift — replaces
 *  the red "לא מאויש" placeholder (WeekTableCell parity). */
export function DayCoveredMarker() {
  return (
    <span
      data-testid="day-covered-12h"
      title="מאויש ע״י משמרת 12 שעות"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 13px',
        borderRadius: 99,
        border: '1.5px solid var(--border)',
        background: 'var(--surface-2)',
        color: 'var(--text-2)',
        fontSize: 12.5,
        fontWeight: 700,
      }}
    >
      12ש׳
    </span>
  )
}
