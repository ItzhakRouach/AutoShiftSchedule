'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { Avatar } from '@/components/ui/Avatar'
import { Btn } from '@/components/ui/Btn'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import { slotAtCapacity } from '@/lib/schedule/validate-edit-core'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { UndoSnapshot } from '@/lib/schedule/undo-core'
import { assignSlot, unassignSlot } from './edit-actions'
import { assignTempName } from './temp-actions'
import { CandidateList } from './CandidateList'
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
  /** Invoked after a successful assign/unassign/temp-add, carrying the undo
   *  snapshot when the action is reversible (assignTwelveHour has none — the
   *  12h pair wizard owns its own snapshot/restore). Lets the owner (ScheduleClient)
   *  surface the same בטל toast used for the fast tap/drag paths. */
  onDone?: (undo?: UndoSnapshot) => void
}

type Msg = { text: string; kind: 'success' | 'warning' | 'error' } | null

export function SwapEditor({ slot, onClose, view, meta, onDone }: Props) {
  const router = useRouter()
  const [, start] = useTransition()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [confirmMove, setConfirmMove] = useState<string | null>(null)
  const closeTimer = useRef<number | null>(null)

  // Guard against a pending auto-close timer from a previous open outliving
  // this component instance (belt-and-suspenders alongside the keyed remount
  // in ScheduleClient, which already gives each slot open a fresh instance).
  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

  if (!slot) return null
  const empById = new Map(view.employees.map((e) => [e.id, e]))

  function handleClose() {
    setConfirmMove(null)
    onClose()
  }

  // Capacity: a role box may not exceed its required headcount. Disable adding
  // base-shift candidates once full (removing/swapping stays available).
  const requiredCount = view.requirements[slot.day]?.[slot.shiftKey]?.[slot.roleId] ?? 0
  const atCapacity = slotAtCapacity(slot.assignedIds.length, requiredCount)

  function run(fn: () => Promise<{ ok: boolean; error?: string; warning?: string; undo?: UndoSnapshot }>) {
    setMsg(null)
    setConfirmMove(null)
    setBusy(true)
    void (async () => {
      try {
        const res = await fn()
        if (!res.ok) {
          setMsg({ text: res.error ?? 'שגיאה', kind: 'error' })
          return
        }
        start(() => router.refresh())
        // Always confirm success so an assignment never reads as "nothing
        // happened". A 12h warning stays up for the manager to read; a plain
        // success shows "שובץ ✓" briefly, then closes. onDone fires the shared
        // בטל toast only once the sheet's own message is gone (immediately for
        // a warning that stays up, or on close for the plain-success case) —
        // otherwise both messages render "שובץ ✓" at once, breaking text lookups.
        if (res.warning) {
          setMsg({ text: res.warning, kind: 'warning' })
          onDone?.(res.undo)
        } else {
          setMsg({ text: 'שובץ ✓', kind: 'success' })
          closeTimer.current = window.setTimeout(() => {
            onClose()
            onDone?.(res.undo)
          }, 800)
        }
      } finally {
        setBusy(false)
      }
    })()
  }

  function pick(employeeId: string) {
    run(() => assignSlot(view.periodId, slot!.day, slot!.shiftTypeId, slot!.roleId, employeeId))
  }

  return (
    <Sheet open onClose={handleClose} title={`${SHIFT_META[slot.shiftKey].name} · ${slot.roleName}`}>
      {msg && <InlineAlert kind={msg.kind}>{msg.text}</InlineAlert>}

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
      {atCapacity && <InlineAlert kind="info">המשמרת מאוישת במלואה לתפקיד זה. הסירו עובד כדי להחליף.</InlineAlert>}

      <CandidateList
        view={view}
        meta={meta}
        slot={slot}
        busy={busy}
        atCapacity={atCapacity}
        confirmMove={confirmMove}
        onPick={pick}
        onConfirmMove={setConfirmMove}
        onCancelMove={() => setConfirmMove(null)}
      />

      <TwelveHourAssign slot={slot} view={view} meta={meta} busy={busy} run={run} />

      <TempNamePrompt
        busy={busy}
        onSubmit={(name) => run(() => assignTempName(view.periodId, slot.day, slot.shiftTypeId, slot.roleId, name))}
      />
    </Sheet>
  )
}
