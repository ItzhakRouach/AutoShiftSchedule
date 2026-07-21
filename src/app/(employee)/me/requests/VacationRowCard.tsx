'use client'

import { Card } from '@/components/ui/Card'
import { formatHebDate, hebrewDayName } from '@/lib/dates/week'
import type { VacationRow, VacationStatus } from '@/lib/requests/context'
import { ABSENCE_KIND_META } from '@/lib/vacations/kind-meta'

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

/** Manager-set kinds (מילואים / מחלה) use the same mechanism as a self-added
 *  vacation, distinguished only by `kind` — workers only ever SEE these labels
 *  (they can't self-mark them; only a manager sets them). Plain 'vacation' is
 *  the worker's own default and needs no extra badge. */
function KindBadge({ kind }: { kind: VacationRow['kind'] }) {
  if (kind === 'vacation') return null
  const m = ABSENCE_KIND_META[kind]
  return (
    <span style={{
      alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, color: m.color,
      background: m.soft, padding: '2px 9px', borderRadius: 'var(--r-pill)',
    }}>
      {m.label}
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
    <Card style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
          יום {hebrewDayName(v.date_from)} {formatHebDate(v.date_from)}
          {v.date_from !== v.date_to && (
            <> — יום {hebrewDayName(v.date_to)} {formatHebDate(v.date_to)}</>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
            cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)',
            flexShrink: 0, alignSelf: 'center', minHeight: 44, minWidth: 44, padding: '10px 12px',
          }}
        >
          הסר
        </button>
      )}
    </Card>
  )
}
