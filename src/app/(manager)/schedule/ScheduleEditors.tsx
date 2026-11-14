'use client'

import type { ScheduleView } from '@/lib/schedule/view-data'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { SlotCtx } from './SwapEditor'
import { SwapEditor, TwelvePairEditor, DayNoteEditor } from './lazy'
import { AssignToast } from './AssignToast'
import type { CellAssign } from './useCellAssign'

interface Props {
  view: ScheduleView
  meta: EditMeta
  assign: CellAssign
  slot: SlotCtx | null
  onCloseSlot: () => void
  pairDay: number | null
  onClosePair: () => void
  showDayNotes: boolean
  onCloseDayNotes: () => void
}

/** The edit-mode overlays of the schedule page (assign window, 12h pair wizard,
 *  day notes) plus the shared toast. Split out of ScheduleClient to keep that
 *  orchestrator within the 200-line budget. */
export function ScheduleEditors({ view, meta, assign, slot, onCloseSlot, pairDay, onClosePair, showDayNotes, onCloseDayNotes }: Props) {
  return (
    <>
      <SwapEditor
        key={slot ? `${slot.day}-${slot.shiftTypeId}-${slot.roleId}` : 'closed'}
        slot={slot}
        onClose={onCloseSlot}
        view={view}
        meta={meta}
        onDone={(undo) => {
          if (!undo) return
          // Push window edits onto the shared undo stack (undo-only — the window
          // doesn't carry enough context to cleanly redo). Removals get 'הוסר ✓'.
          const removed = undo.kind === 'unassign' || undo.kind === 'temp-remove'
          assign.history.push({ undo, redo: null, label: removed ? 'הסרה' : 'שיבוץ' })
          assign.setToast({ text: removed ? 'הוסר ✓' : 'שובץ ✓', kind: 'ok' })
        }}
      />
      <TwelvePairEditor day={pairDay} onClose={onClosePair} view={view} meta={meta} />
      <DayNoteEditor open={showDayNotes} onClose={onCloseDayNotes} view={view} />
      <AssignToast toast={assign.toast} onDismiss={assign.dismissToast} />
    </>
  )
}
