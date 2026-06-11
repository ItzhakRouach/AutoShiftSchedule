'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { Avatar } from '@/components/ui/Avatar'
import { Btn } from '@/components/ui/Btn'
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import { candidateStatus } from '@/lib/schedule/candidate-status'
import { slotAtCapacity } from '@/lib/schedule/validate-edit-core'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { ScheduleView } from '@/lib/schedule/view-data'
import { assignSlot, unassignSlot } from './edit-actions'
import { assignTempName } from './temp-actions'
import { TempNamePrompt } from './TempNamePrompt'
import { TwelveHourAssign } from './TwelveHourAssign'

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

  if (!slot) return null
  const empById = new Map(view.employees.map((e) => [e.id, e]))

  // Capacity: a role box may not exceed its required headcount. Disable adding
  // base-shift candidates once full (removing/swapping stays available).
  const requiredCount = view.requirements[slot.day]?.[slot.shiftKey]?.[slot.roleId] ?? 0
  const atCapacity = slotAtCapacity(slot.assignedIds.length, requiredCount)

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
        start(() => router.refresh())
        // Always confirm success so an assignment never reads as "nothing
        // happened". A 12h warning stays up for the manager to read; a plain
        // success shows "שובץ ✓" briefly, then closes.
        if (res.warning) {
          setMsg(res.warning)
        } else {
          setMsg('שובץ ✓')
          window.setTimeout(onClose, 800)
        }
      } finally {
        setBusy(false)
      }
    })()
  }


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
      {atCapacity && (
        <div style={{ padding: '9px 12px', borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--text-2)', fontSize: 12.5, marginBottom: 8 }}>
          המשמרת מאוישת במלואה לתפקיד זה. הסירו עובד כדי להחליף.
        </div>
      )}
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
          const blocked = cand.disabled || atCapacity
          const assignOrConfirm = () => {
            // The DB keeps one shift per employee per day, so assigning someone
            // already scheduled that day MOVES them. Confirm so the silent swap
            // is intentional (otherwise it reads as "nothing happened" elsewhere).
            if (cand.status === 'assigned_other' && !window.confirm('עובד זה כבר משובץ במשמרת אחרת ביום זה — להעביר אותו לכאן?')) return
            run(() => assignSlot(view.periodId, slot.day, slot.shiftTypeId, slot.roleId, e.id))
          }
          return (
            <button
              key={e.id}
              disabled={blocked || busy}
              onClick={assignOrConfirm}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '8px 11px', borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--surface)', cursor: blocked ? 'default' : 'pointer',
                opacity: blocked ? 0.5 : 1, fontFamily: 'var(--font)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={e.name} color={e.color} size={26} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{e.name}</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: blocked ? '#EB6A4E' : 'var(--accent)' }}>
                {cand.disabled ? cand.label : atCapacity ? 'מלא' : cand.label}
              </span>
            </button>
          )
        })}
      </div>

      <TwelveHourAssign slot={slot} view={view} meta={meta} busy={busy} run={run} />

      <TempNamePrompt
        busy={busy}
        onSubmit={(name) => run(() => assignTempName(view.periodId, slot.day, slot.shiftTypeId, slot.roleId, name))}
      />
    </Sheet>
  )
}
