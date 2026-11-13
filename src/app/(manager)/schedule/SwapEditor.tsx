'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import { dayTitle } from '@/lib/domain/days'
import type { GroupedCandidate } from '@/lib/schedule/candidate-groups'
import { slotAtCapacity } from '@/lib/schedule/validate-edit-core'
import { buildWeekGrid, buildSlotMarkMap } from '@/lib/schedule/week-table-data'
import { coveredByTwelve } from '@/lib/schedule/week-table-twelve'
import { buildDayRoleRow } from '@/lib/schedule/day-grid-rows'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { UndoSnapshot } from '@/lib/schedule/undo-core'
import { assignSlot, unassignSlot } from './edit-actions'
import { assignTempName } from './temp-actions'
import { setSlotMark, clearSlotMark } from './slot-mark-actions'
import { CandidateList } from './CandidateList'
import { TempNamePrompt } from './TempNamePrompt'
import { SlotMarkPrompt } from './SlotMarkPrompt'
import { TwelveHourAssign } from './TwelveHourAssign'
import { AssignHeader } from './AssignHeader'
import { BackToList, MoreOptions, OverrideConfirm, type AssignMode } from './AssignSteps'

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
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [confirm, setConfirm] = useState<GroupedCandidate | null>(null)
  const closeTimer = useRef<number | null>(null)

  // Guard against a pending auto-close timer from a previous open outliving
  // this component instance (belt-and-suspenders alongside the keyed remount
  // in ScheduleClient, which already gives each slot open a fresh instance).
  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

  // Marking only reads on a cell with nothing in it — no occupant, no 12h
  // coverage. Reuses the day-view row builder so "empty" means exactly what the
  // table and the day cards mean by it. Memoized because the window re-renders
  // on every keystroke in SlotMarkPrompt, and this rebuilds the whole week grid.
  const markRow = useMemo(
    () =>
      slot
        ? buildDayRoleRow(
            view, buildWeekGrid(view), coveredByTwelve(view),
            slot.day, slot.shiftKey, slot.roleId, buildSlotMarkMap(view),
          )
        : null,
    [view, slot],
  )
  // A cell that is already marked opens straight on its mark, ready to edit or remove.
  const [mode, setMode] = useState<AssignMode>(() => (markRow?.markLabel !== undefined ? 'mark' : 'list'))

  if (!slot) return null
  const empById = new Map(view.employees.map((e) => [e.id, e]))
  const shift = view.shiftMeta?.[slot.shiftKey] ?? SHIFT_META[slot.shiftKey]
  const where = `${dayTitle(slot.day)} ${view.days[slot.day]?.date ?? ''} · ${shift.name}`

  // Capacity: a role box may not exceed its required headcount. Disable adding
  // base-shift candidates once full (removing/swapping stays available).
  const requiredCount = view.requirements[slot.day]?.[slot.shiftKey]?.[slot.roleId] ?? 0
  const atCapacity = slotAtCapacity(slot.assignedIds.length, requiredCount)

  function run(
    fn: () => Promise<{ ok: boolean; error?: string; warning?: string; undo?: UndoSnapshot }>,
    okText = 'שובץ ✓',
  ) {
    setMsg(null)
    setBusy(true)
    void (async () => {
      try {
        const res = await fn()
        if (!res.ok) {
          setMsg({ text: res.error ?? 'שגיאה', kind: 'error' })
          return
        }
        // Always confirm success so an assignment never reads as "nothing
        // happened". A 12h warning stays up for the manager to read; a plain
        // success closes the window on its own.
        if (res.warning) {
          setMsg({ text: res.warning, kind: 'warning' })
        } else {
          setMsg({ text: okText, kind: 'success' })
          closeTimer.current = window.setTimeout(onClose, 800)
        }
        onDone?.(res.undo)
      } finally {
        setBusy(false)
        setConfirm(null)
      }
    })()
  }

  const canMark = !!markRow && markRow.entries.length === 0 && markRow.covered === 0
  const pick = (employeeId: string) =>
    run(() => assignSlot(view.periodId, slot.day, slot.shiftTypeId, slot.roleId, employeeId))

  return (
    <Sheet open onClose={onClose} title={where} testId="assign-dialog">
      {msg && <InlineAlert kind={msg.kind}>{msg.text}</InlineAlert>}

      {confirm ? (
        <OverrideConfirm candidate={confirm} where={where} busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => pick(confirm.id)} />
      ) : mode === 'list' ? (
        <>
          <AssignHeader
            roleName={slot.roleName}
            time={shift.time}
            required={requiredCount}
            assigned={slot.assignedIds.flatMap((id) => empById.get(id) ?? [])}
            busy={busy}
            onRemove={(id) => run(() => unassignSlot(view.periodId, id, slot.day), 'הוסר ✓')}
          />
          {atCapacity && <InlineAlert kind="info">המשמרת מאוישת במלואה לתפקיד זה. הסירו עובד כדי להחליף.</InlineAlert>}
          <CandidateList view={view} meta={meta} slot={slot} busy={busy} atCapacity={atCapacity} onPick={pick} onPickOverride={setConfirm} />
          <MoreOptions canMark={canMark} onMode={setMode} />
        </>
      ) : (
        <>
          <BackToList onBack={() => setMode('list')} />
          {mode === 'twelve' && <TwelveHourAssign slot={slot} view={view} meta={meta} busy={busy} run={run} />}
          {mode === 'temp' && (
            <TempNamePrompt
              busy={busy}
              onSubmit={(name) => run(() => assignTempName(view.periodId, slot.day, slot.shiftTypeId, slot.roleId, name))}
            />
          )}
          {mode === 'mark' && canMark && (
            <SlotMarkPrompt
              // Remount when the stored caption changes underneath us (another tab
              // or device) so the input never submits a stale value back.
              key={markRow?.markLabel ?? '\u2205'}
              busy={busy}
              currentLabel={markRow?.markLabel}
              onSubmit={(label) => run(
                () => setSlotMark(view.periodId, slot.day, slot.shiftTypeId, slot.roleId, label),
                'סומן ✓',
              )}
              onClear={() => run(
                () => clearSlotMark(view.periodId, slot.day, slot.shiftTypeId, slot.roleId),
                'הסימון הוסר ✓',
              )}
            />
          )}
        </>
      )}
    </Sheet>
  )
}
