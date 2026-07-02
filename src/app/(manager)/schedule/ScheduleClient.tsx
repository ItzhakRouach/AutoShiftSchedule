'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { WorkplaceVacation } from '@/lib/vacations/pending'
import { useScheduleActions } from './useScheduleActions'
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

interface Props {
  view: ScheduleView
  editMeta: EditMeta | null
  workerVacations: WorkplaceVacation[]
}

type ViewMode = 'schedule' | 'requests'

const VIEW_OPTIONS = [
  { value: 'schedule', label: 'סידור' },
  { value: 'requests', label: 'בקשות עובדים' },
]

export function ScheduleClient({ view, editMeta, workerVacations }: Props) {
  const a = useScheduleActions(view)
  const [slot, setSlot] = useState<SlotCtx | null>(null)
  const [pairDay, setPairDay] = useState<number | null>(null)
  const [showDayNotes, setShowDayNotes] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('schedule')
  // Fast drag / tap-to-assign (edit mode only).
  const assign = useCellAssign(view)

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--text-h1)', fontWeight: 800 }}>סידור עבודה</h1>
        {pct !== null && (
          <div style={{
            textAlign: 'center',
            background: pct >= 95 ? 'rgba(19,169,142,0.12)' : 'rgba(235,106,78,0.12)',
            borderRadius: 'var(--r-md)',
            padding: '8px 13px',
          }}>
            <div
              style={{ fontSize: 20, fontWeight: 800, color: pct >= 95 ? '#13A98E' : '#EB6A4E', lineHeight: 1 }}
              data-testid="coverage"
            >
              {pct}%
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>כיסוי</div>
          </div>
        )}
      </div>

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

      {!hasResult && (
        <Card style={{ textAlign: 'center', padding: '24px 20px', marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>בונים את הסידור עבורכם</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>
            צרו סידור אוטומטי לפי הבקשות והתפקידים — או בנו אותו ידנית בטבלה למטה, תא אחר תא.
          </div>
        </Card>
      )}

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
      />

      <div style={{ height: 14 }} />
      <Segmented
        options={VIEW_OPTIONS}
        value={viewMode}
        onChange={(v) => setViewMode(v as ViewMode)}
      />
      </div>{/* schedule-controls */}
      <div style={{ height: 14 }} />

      {viewMode === 'requests' && (
        <RequestsOverview view={view} workerVacations={workerVacations} />
      )}

      {/* Managers can open the grid to build by hand even before the auto-run
          (empty cells are fillable via drag/tap/temp workers). */}
      {viewMode === 'schedule' && (hasResult || !!editMeta) && (
        <>
          {editMeta && (
            <WorkerPalette employees={view.employees} heldId={assign.heldId} onHold={assign.hold} disabled={!!assign.pendingSlot} />
          )}
          <ScheduleGrids
            view={view}
            onSlot={editMeta ? setSlot : undefined}
            onDayPair={editMeta ? setPairDay : undefined}
            assign={editMeta ? assign : undefined}
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
              // The sheet already shows its own inline "שובץ ✓"/warning message;
              // once it closes (or immediately, for a warning that stays up) also
              // surface the shared בטל toast so sheet-made edits are reversible
              // the same way fast tap/drag assigns are. Removals (unassign/
              // temp-remove) get 'הוסר ✓' instead of 'שובץ ✓'.
              const removed = undo.kind === 'unassign' || undo.kind === 'temp-remove'
              assign.setToast({ text: removed ? 'הוסר ✓' : 'שובץ ✓', kind: 'ok', onUndo: () => assign.runUndo(undo) })
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
