'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { Avatar } from '@/components/ui/Avatar'
import { Btn } from '@/components/ui/Btn'
import { SHIFT_META, FALLBACK_12H_ORDER, type ShiftId } from '@/lib/domain/constants'
import { candidateStatus } from '@/lib/schedule/candidate-status'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { ScheduleView } from '@/lib/schedule/view-data'
import { assignSlot, unassignSlot, assignTwelveHour } from './edit-actions'

export interface SlotCtx {
  day: number
  shiftKey: ShiftId
  shiftTypeId: string
  roleId: string
  roleName: string
  assignedIds: string[]
  /** Optional day metadata for holiday-aware checks. */
  dayMeta?: { isHolidayEve: boolean; isHoliday: boolean }
}

interface Props {
  slot: SlotCtx | null
  onClose: () => void
  view: ScheduleView
  meta: EditMeta
}

export function SwapEditor({ slot, onClose, view, meta }: Props) {
  const router = useRouter()
  const [, start] = useTransition()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [variant, setVariant] = useState<ShiftId | null>(null)

  if (!slot) return null
  const empById = new Map(view.employees.map((e) => [e.id, e]))

  function run(fn: () => Promise<{ ok: boolean; error?: string; warning?: string }>) {
    setMsg(null)
    setBusy(true)
    void (async () => {
      try {
        const res = await fn()
        if (!res.ok) {
          setMsg(res.error ?? 'שגיאה')
          return
        }
        if (res.warning) setMsg(res.warning)
        start(() => router.refresh())
        if (!res.warning) onClose()
      } finally {
        setBusy(false)
      }
    })()
  }

  const twelveId = variant ? meta.keyToShiftTypeId[variant] : null

  return (
    <Sheet open onClose={onClose} title={`${SHIFT_META[slot.shiftKey].name} · ${slot.roleName}`}>
      {msg && (
        <div style={{ padding: '9px 12px', borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--text)', fontSize: 13, marginBottom: 12 }}>
          {msg}
        </div>
      )}

      {slot.assignedIds.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {slot.assignedIds.map((id) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={empById.get(id)?.name ?? '?'} color={empById.get(id)?.color ?? '#888'} size={26} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{empById.get(id)?.name}</span>
              </span>
              <Btn variant="danger" size="sm" disabled={busy} onClick={() => run(() => unassignSlot(view.periodId, id, slot.day))}>
                הסר
              </Btn>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '6px 0 8px' }}>עובדים זמינים</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '38vh', overflowY: 'auto' }}>
        {view.employees.map((e) => {
          const em = meta.employees[e.id]
          if (!em) return null
          const cand = candidateStatus({
            emp: em,
            day: slot.day,
            shiftKey: slot.shiftKey,
            roleId: slot.roleId,
            minRestHours: meta.minRestHours,
            requestedPreferred: em.preferred[slot.day],
            dayMeta: slot.dayMeta,
          })
          return (
            <button
              key={e.id}
              disabled={cand.disabled || busy}
              onClick={() => run(() => assignSlot(view.periodId, slot.day, slot.shiftTypeId, slot.roleId, e.id))}
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
              <span style={{ fontSize: 12, fontWeight: 700, color: cand.disabled ? '#EB6A4E' : 'var(--accent)' }}>{cand.label}</span>
            </button>
          )
        })}
      </div>

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
    </Sheet>
  )
}
