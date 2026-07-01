'use client'

import { Avatar } from '@/components/ui/Avatar'
import { Btn } from '@/components/ui/Btn'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { candidateStatus } from '@/lib/schedule/candidate-status'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { SlotCtx } from './SwapEditor'

const MOVE_CONFIRM_MSG = 'עובד זה כבר משובץ במשמרת אחרת ביום זה — להעביר אותו לכאן?'

interface Props {
  view: ScheduleView
  meta: EditMeta
  slot: SlotCtx
  busy: boolean
  atCapacity: boolean
  confirmMove: string | null
  onPick: (employeeId: string) => void
  onConfirmMove: (employeeId: string) => void
  onCancelMove: () => void
}

/** The "available employees" candidate list inside the slot editor sheet —
 *  split out of SwapEditor to keep both files ≤200 lines. Owns the
 *  assigned-elsewhere inline confirm strip (tap → confirm → assign). */
export function CandidateList({ view, meta, slot, busy, atCapacity, confirmMove, onPick, onConfirmMove, onCancelMove }: Props) {
  return (
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
        const confirming = confirmMove === e.id
        const handleClick = () => {
          // The DB keeps one shift per employee per day, so assigning someone
          // already scheduled that day MOVES them. Confirm so the silent swap
          // is intentional (otherwise it reads as "nothing happened" elsewhere).
          if (cand.status === 'assigned_other') {
            onConfirmMove(e.id)
            return
          }
          onPick(e.id)
        }
        return (
          <div key={e.id}>
            <button
              disabled={blocked || busy}
              onClick={handleClick}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                width: '100%', padding: '8px 11px', borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--surface)', cursor: blocked ? 'default' : 'pointer',
                opacity: blocked ? 0.5 : 1, fontFamily: 'var(--font)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={e.name} color={e.color} size={26} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{e.name}</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: blocked ? 'var(--danger)' : 'var(--accent)' }}>
                {cand.disabled ? cand.label : atCapacity ? 'מלא' : cand.label}
              </span>
            </button>
            {confirming && (
              <div style={{ marginTop: 6 }}>
                <InlineAlert kind="warning" style={{ marginBottom: 8 }}>{MOVE_CONFIRM_MSG}</InlineAlert>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="soft" size="sm" style={{ flex: 1 }} disabled={busy} onClick={onCancelMove}>
                    ביטול
                  </Btn>
                  <Btn variant="primary" size="sm" style={{ flex: 1 }} disabled={busy} onClick={() => onPick(e.id)}>
                    העבר
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
