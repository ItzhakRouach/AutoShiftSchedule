'use client'

import { useState } from 'react'
import { LtrText } from '@/components/ui/LtrText'
import { SHIFT_META, FALLBACK_12H_ORDER, type ShiftId } from '@/lib/domain/constants'
import { TWELVE_HOUR_COVERS } from '@/lib/scheduling/fallback'
import { candidateStatus } from '@/lib/schedule/candidate-status'
import { CANDIDATE_REASONS } from '@/lib/schedule/candidate-groups'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { SlotCtx } from './SwapEditor'
import { assignTwelveHour } from './edit-actions'
import type { EditResult } from './edit-actions-helpers'
import { CandidateRow } from './CandidateRow'

interface Props {
  slot: SlotCtx
  view: ScheduleView
  meta: EditMeta
  busy: boolean
  run: (fn: () => Promise<EditResult>) => void
}

const stepLabel: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-2)', margin: '0 0 6px' }

const coversText = (v: ShiftId) =>
  (TWELVE_HOUR_COVERS[v as keyof typeof TWELVE_HOUR_COVERS] ?? []).map((k) => SHIFT_META[k as ShiftId].name).join(' + ')

/** The 12-hour step of the assign window: pick the hours, then the worker. */
export function TwelveHourAssign({ slot, view, meta, busy, run }: Props) {
  const [variant, setVariant] = useState<ShiftId | null>(null)
  const twelveId = variant ? meta.keyToShiftTypeId[variant] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 'var(--text-body)', color: 'var(--text-2)' }}>
        עובד אחד מכסה שתי משמרות רצופות. בחרו את השעות ואז את העובד.
      </p>

      <div>
        <div style={stepLabel}>1. שעות</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${FALLBACK_12H_ORDER.length}, minmax(0, 1fr))`, gap: 8 }}>
          {FALLBACK_12H_ORDER.map((v) => {
            const on = variant === v
            return (
              <button
                key={v}
                type="button"
                data-testid="twelve-variant"
                aria-pressed={on}
                onClick={() => setVariant(v)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 6px',
                  borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'var(--font)', color: 'var(--text)',
                  border: `2px solid ${on ? 'var(--warning)' : 'var(--border)'}`,
                  background: on ? 'var(--warning-soft)' : 'var(--surface)',
                }}
              >
                <span className="tabular" style={{ fontSize: 'var(--text-h2)', fontWeight: 800 }}><LtrText>{SHIFT_META[v].time}</LtrText></span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>מכסה {coversText(v)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {variant && twelveId && (
        <div>
          <div style={stepLabel}>2. עובד</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {view.employees.map((e) => {
              const em = meta.employees[e.id]
              if (!em) return null
              const cand = candidateStatus({
                emp: em,
                day: slot.day,
                shiftKey: variant,
                roleId: slot.roleId,
                minRestHours: meta.minRestHours,
                dayMeta: slot.dayMeta,
              })
              return (
                <div key={e.id} data-testid="twelve-candidate">
                  <CandidateRow
                    name={e.name} color={e.color}
                    tone={cand.disabled ? 'blocked' : 'available'}
                    reason={cand.disabled ? CANDIDATE_REASONS[cand.status] ?? cand.label : undefined}
                    action={cand.disabled ? undefined : 'שיבוץ ל-12 שעות'}
                    disabled={cand.disabled || busy}
                    onClick={() => run(() => assignTwelveHour(view.periodId, slot.day, twelveId, slot.roleId, e.id))}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
