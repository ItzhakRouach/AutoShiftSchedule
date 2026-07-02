'use client'

import { Card } from '@/components/ui/Card'
import { formatHebDate, hebrewDayName } from '@/lib/dates/week'
import type { VacationRow, VacationStatus } from '@/lib/requests/context'

const STATUS_META: Record<VacationStatus, { label: string; color: string; soft: string }> = {
  pending: { label: 'ממתין לאישור', color: 'var(--warning)', soft: 'var(--warning-soft)' },
  approved: { label: 'אושר ✓', color: 'var(--success)', soft: 'var(--success-soft)' },
  rejected: { label: 'נדחה', color: 'var(--danger)', soft: 'var(--danger-soft)' },
}

function VacationStatusBadge({ status }: { status: VacationStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.pending
  return (
    <span style={{
      alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, color: m.color,
      background: m.soft, padding: '2px 9px', borderRadius: 'var(--r-pill)',
    }}>
      {m.label}
    </span>
  )
}

/** Manager-set military reserve duty (מילואים) uses the same mechanism as a
 *  vacation, distinguished only by `kind` — workers only ever SEE this label
 *  (they can't self-mark miluim; only a manager sets it). */
function KindBadge({ kind }: { kind: VacationRow['kind'] }) {
  if (kind !== 'miluim') return null
  return (
    <span style={{
      alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, color: 'var(--warning)',
      background: 'var(--warning-soft)', padding: '2px 9px', borderRadius: 'var(--r-pill)',
    }}>
      מילואים
    </span>
  )
}

interface Props {
  vacation: VacationRow
  isReadOnly: boolean
  disabled: boolean
  onRemove: (id: string) => void
}

/** One vacation/miluim range card in the employee's list. Split out of
 *  VacationSection to keep that file ≤200 lines. */
export function VacationRowCard({ vacation: v, isReadOnly, disabled, onRemove }: Props) {
  return (
    <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          יום {hebrewDayName(v.date_from)} {formatHebDate(v.date_from)}
          {v.date_from !== v.date_to && (
            <> — יום {hebrewDayName(v.date_to)} {formatHebDate(v.date_to)}</>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <VacationStatusBadge status={v.status} />
          <KindBadge kind={v.kind} />
        </div>
      </div>
      {!isReadOnly && (
        <button
          onClick={() => onRemove(v.id)}
          disabled={disabled}
          style={{
            border: 'none', background: 'transparent', color: 'var(--danger)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', padding: '4px 8px',
          }}
        >
          הסר
        </button>
      )}
    </Card>
  )
}
