'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Segmented } from '@/components/ui/Segmented'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { WorkplaceVacation } from '@/lib/vacations/pending'
import { useScheduleActions } from './useScheduleActions'
import { EmptyStateCard } from './EmptyStateCard'
import { FeasibilityBanner } from './FeasibilityBanner'
import { CoverageIssues } from './CoverageIssues'
import { ScheduleGrids } from './ScheduleGrids'
import { RequestsOverview } from './RequestsOverview'
import { SwapEditor, type SlotCtx } from './SwapEditor'
import { TwelvePairEditor } from './TwelvePairEditor'
import { DayNoteEditor } from './DayNoteEditor'
import { DayNotesSummary } from './DayNotesSummary'
import { Generating } from './parts'
import { RegenerateConfirm } from './RegenerateConfirm'
import { PublishControls } from './PublishControls'
import { WorkerPalette } from './WorkerPalette'
import { AssignToast } from './AssignToast'
import { useCellAssign } from './useCellAssign'
import { GenerateControls } from './GenerateControls'
import { ScheduleHeader } from './ScheduleHeader'
import { copyLastWeekSchedule } from './copy-actions'
import { UndoRedoBar } from './UndoRedoBar'
import { RolelessNotice } from './RolelessNotice'

interface Props {
  view: ScheduleView
  editMeta: EditMeta | null
  workerVacations: WorkplaceVacation[]
  /** Active employees with no role — excluded from scheduling (shown as a notice). */
  rolelessEmployees: { id: string; name: string }[]
}

type ViewMode = 'schedule' | 'requests'

const VIEW_OPTIONS = [
  { value: 'schedule', label: 'סידור' },
  { value: 'requests', label: 'בקשות עובדים' },
]

export function ScheduleClient({ view, editMeta, workerVacations, rolelessEmployees }: Props) {
  const a = useScheduleActions(view)
  const [slot, setSlot] = useState<SlotCtx | null>(null)
  const [pairDay, setPairDay] = useState<number | null>(null)
  const [showDayNotes, setShowDayNotes] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('schedule')
  const router = useRouter()
  const [copying, startCopy] = useTransition()
  // Fast drag / tap-to-assign (edit mode only).
  const assign = useCellAssign(view)

  // Confirmation is a two-step inline flow owned by GenerateControls' button.
  function handleCopyLastWeek() {
    startCopy(async () => {
      const res = await copyLastWeekSchedule(view.periodId)
      if (!res.ok) { assign.setToast({ text: res.error ?? 'שגיאה', kind: 'err' }); return }
      assign.setToast({ text: 'הועתק מהשבוע הקודם ✓', kind: 'ok' })
      router.refresh()
    })
  }

  const {
    coverage, suggestions, overriddenOff, uncovered, showIssues, setShowIssues,
    error, published, publishing, checking, running, hasResult, showConfirm, setShowConfirm,
    triggerGenerate, handleGenerateClick, completeTwelveHour, publish, resetAfterDelete,
  } = a

  if (running) return <Generating />

  const pct = coverage ? coverage.percent : null

  return (
    <div>
      {showConfirm && (
        <RegenerateConfirm
          busy={running}
          onKeep={() => triggerGenerate(false)}
          onReplace={() => triggerGenerate(true)}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div className="schedule-controls">
      <ScheduleHeader view={view} pct={pct} />

      <RolelessNotice employees={rolelessEmployees} />

      <FeasibilityBanner feasibility={view.feasibility} />

      <CoverageIssues open={showIssues} overridden={overriddenOff} uncovered={uncovered} view={view} onClose={() => setShowIssues(false)} />

      {error && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 'var(--r-md)',
          background: 'rgba(235,106,78,0.1)',
          color: '#EB6A4E',
          fontSize: 13.5,
          fontWeight: 600,
          marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      {!hasResult && <EmptyStateCard view={view} />}

      <GenerateControls
        view={view}
        editMeta={editMeta}
        status={view.status}
        hasResult={hasResult}
        checking={checking}
        running={running}
        onOpenDayNotes={() => setShowDayNotes(true)}
        onGenerateClick={handleGenerateClick}
        onCompleteTwelveHour={completeTwelveHour}
        onCopyLastWeek={handleCopyLastWeek}
        copying={copying}
      />

      <div style={{ height: 14 }} />
      <Segmented
        options={VIEW_OPTIONS}
        value={viewMode}
        onChange={(v) => setViewMode(v as ViewMode)}
      />
      </div>{/* schedule-controls */}
      <div style={{ height: 14 }} />

      {/* Kept mounted (hidden when inactive) so manager-entered requests aren't
          lost when switching to the סידור tab — the local grid mirror survives. */}
      <div style={{ display: viewMode === 'requests' ? undefined : 'none' }}>
        <RequestsOverview view={view} workerVacations={workerVacations} />
      </div>

      {/* Managers can open the grid to build by hand even before the auto-run
          (empty cells are fillable via drag/tap/temp workers). */}
      {viewMode === 'schedule' && (hasResult || !!editMeta) && (
        <>
          {editMeta && (
            <>
              <WorkerPalette employees={view.employees} heldId={assign.heldId} onHold={assign.hold} disabled={!!assign.pendingSlot} />
              <UndoRedoBar history={assign.history} />
            </>
          )}
          <ScheduleGrids
            view={view}
            onSlot={editMeta ? setSlot : undefined}
            onDayPair={editMeta ? setPairDay : undefined}
            assign={editMeta ? assign : undefined}
            editMeta={editMeta}
          />
          <DayNotesSummary view={view} />
          {hasResult && (
            <PublishControls
              view={view}
              suggestions={suggestions}
              published={published}
              publishing={publishing}
              onPublish={publish}
              onUnpublished={() => a.setPublished(false)}
              onDeleted={resetAfterDelete}
            />
          )}
        </>
      )}

      {editMeta && (
        <>
          <SwapEditor
            key={slot ? `${slot.day}-${slot.shiftTypeId}-${slot.roleId}` : 'closed'}
            slot={slot}
            onClose={() => setSlot(null)}
            view={view}
            meta={editMeta}
            onDone={(undo) => {
              if (!undo) return
              // Push sheet edits onto the shared undo stack (undo-only — the sheet
              // doesn't carry enough context to cleanly redo). Removals get 'הוסר ✓'.
              const removed = undo.kind === 'unassign' || undo.kind === 'temp-remove'
              assign.history.push({ undo, redo: null, label: removed ? 'הסרה' : 'שיבוץ' })
              assign.setToast({ text: removed ? 'הוסר ✓' : 'שובץ ✓', kind: 'ok' })
            }}
          />
          <TwelvePairEditor day={pairDay} onClose={() => setPairDay(null)} view={view} meta={editMeta} />
          <DayNoteEditor open={showDayNotes} onClose={() => setShowDayNotes(false)} view={view} />
          <AssignToast toast={assign.toast} onDismiss={assign.dismissToast} />
        </>
      )}
    </div>
  )
}
