'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { SHIFT_META, FALLBACK_12H_ORDER, type ShiftId } from '@/lib/domain/constants'
import { candidateStatus } from '@/lib/schedule/candidate-status'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { SlotCtx } from './SwapEditor'
import { assignTwelveHour } from './edit-actions'
import type { EditResult } from './edit-actions-helpers'

interface Props {
  slot: SlotCtx
  view: ScheduleView
  meta: EditMeta
  busy: boolean
  run: (fn: () => Promise<EditResult>) => void
}

/** The "apply a 12h fallback shift" section of the slot editor — a variant
 *  picker plus its candidate list. Split out to keep SwapEditor ≤200 lines. */
export function TwelveHourAssign({ slot, view, meta, busy, run }: Props) {
  const [variant, setVariant] = useState<ShiftId | null>(null)
  const twelveId = variant ? meta.keyToShiftTypeId[variant] : null

  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '16px 0 8px' }}>החל משמרת 12 שעות</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {FALLBACK_12H_ORDER.map((v) => (
          <button
            key={v}
            onClick={() => setVariant(v)}
            style={{
              padding: '6px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font)',
              cursor: 'pointer',
              border: `1px solid ${variant === v ? 'var(--accent)' : 'var(--border)'}`,
              background: variant === v ? 'var(--accent-soft)' : 'var(--surface)',
              color: variant === v ? 'var(--accent)' : 'var(--text)',
            }}
          >
            {SHIFT_META[v].name}
          </button>
        ))}
      </div>
      {variant && twelveId && (
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
              <button
                key={e.id}
                disabled={cand.disabled || busy}
                onClick={() => run(() => assignTwelveHour(view.periodId, slot.day, twelveId, slot.roleId, e.id))}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '8px 11px', borderRadius: 12, border: '1px solid var(--border)',
                  background: 'var(--surface)', cursor: cand.disabled ? 'default' : 'pointer',
                  opacity: cand.disabled ? 0.5 : 1, fontFamily: 'var(--font)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={e.name} color={e.color} size={26} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{e.name}</span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: cand.disabled ? '#EB6A4E' : 'var(--accent)' }}>
                  {cand.disabled ? cand.label : `${e.name} — 12ש׳`}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
