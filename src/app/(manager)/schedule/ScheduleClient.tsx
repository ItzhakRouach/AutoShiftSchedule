'use client'

import { useState, useTransition } from 'react'
import { Segmented } from '@/components/ui/Segmented'
import { InlineAlert } from '@/components/ui/InlineAlert'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { WorkplaceVacation } from '@/lib/vacations/pending'
import { useScheduleActions } from './useScheduleActions'
import { EmptyStateCard } from './EmptyStateCard'
import { FeasibilityBanner } from './FeasibilityBanner'
import { ScheduleWorkArea } from './ScheduleWorkArea'
import { RequestsOverview } from './RequestsOverview'
import { DayNotesSummary } from './DayNotesSummary'
import { Generating } from './parts'
import { PublishControls } from './PublishControls'
import { WorkerPalette } from './WorkerPalette'
import { useCellAssign } from './useCellAssign'
import type { SlotCtx } from './SwapEditor'
import { ScheduleEditors } from './ScheduleEditors'
import { ScheduleActionBar } from './ScheduleActionBar'
import { ScheduleLegend } from './ScheduleLegend'
import { CoverageIssues, DistributionDrawer, MoreActionsSheet, RegenerateConfirm, TwelveProposalSheet } from './lazy'
import { AiImprove } from './AiImprove'
import { countUncoveredCells } from '@/lib/schedule/week-table-data'
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
  const [showDist, setShowDist] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showProposal, setShowProposal] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('schedule')
  const [copying, startCopy] = useTransition()
  // Fast drag / tap-to-assign (edit mode only).
  const assign = useCellAssign(view)

  // Confirmation is a two-step inline flow owned by MoreActionsSheet's button.
  function handleCopyLastWeek() {
    startCopy(async () => {
      const res = await copyLastWeekSchedule(view.periodId)
      if (!res.ok) { assign.setToast({ text: res.error ?? 'שגיאה', kind: 'err' }); return }
      assign.setToast({ text: 'הועתק מהשבוע הקודם ✓', kind: 'ok' })
    })
  }

  const {
    coverage, suggestions, overriddenOff, uncovered, nightImbalance, showIssues, setShowIssues,
    error, published, publishing, checking, running, hasResult, showConfirm, setShowConfirm,
    triggerGenerate, handleGenerateClick, completeTwelveHour, publish, resetAfterDelete,
  } = a

  if (running) return <Generating />

  const pct = coverage ? coverage.percent : null
  const gaps = countUncoveredCells(view)
  const canPublish = hasResult || published

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

      <ScheduleHeader
        view={view}
        pct={pct}
        state={published ? 'published' : hasResult ? 'draft' : 'empty'}
        onOpenDistribution={() => setShowDist(true)}
      />

      <div className="schedule-controls">
      <RolelessNotice employees={rolelessEmployees} />

      <FeasibilityBanner feasibility={view.feasibility} />

      <CoverageIssues open={showIssues} overridden={overriddenOff} uncovered={uncovered} nightImbalance={nightImbalance} view={view} onClose={() => setShowIssues(false)} onProposeTwelve={editMeta && !published ? () => { setShowIssues(false); setShowProposal(true) } : undefined} />
      <TwelveProposalSheet open={showProposal} onClose={() => setShowProposal(false)} view={view} running={running} onApply={completeTwelveHour} />

      {error && <InlineAlert kind="error" style={{ marginBottom: 14 }}>{error}</InlineAlert>}

      {!hasResult && <EmptyStateCard view={view} />}

      {hasResult && !published && <AiImprove periodId={view.periodId} employees={view.employees} />}

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
      {viewMode === 'schedule' && (canPublish || !!editMeta) && (
        <>
          {editMeta && (
            <>
              <WorkerPalette employees={view.employees} heldId={assign.heldId} onHold={assign.hold} disabled={!!assign.pendingSlot} />
              <UndoRedoBar history={assign.history} />
            </>
          )}
          <ScheduleLegend />
          <ScheduleWorkArea
            view={view}
            onSlot={editMeta ? setSlot : undefined}
            onDayPair={editMeta ? setPairDay : undefined}
            assign={editMeta ? assign : undefined}
            editMeta={editMeta}
          />
          <DayNotesSummary view={view} />

          <DistributionDrawer open={showDist} onClose={() => setShowDist(false)} view={view} editMeta={editMeta} />
          {/* `published` alone (no assignments) still needs the controls: a
              cron-published empty week is otherwise impossible to unpublish. */}
          {canPublish && (
            <PublishControls view={view} suggestions={suggestions} published={published} onUnpublished={() => a.setPublished(false)} />
          )}
        </>
      )}

      <ScheduleActionBar
        gaps={gaps}
        canPublish={canPublish}
        published={published}
        publishing={publishing}
        checking={checking}
        onPublish={publish}
        onGenerate={handleGenerateClick}
        onMore={() => setShowMore(true)}
      />
      <MoreActionsSheet
        open={showMore}
        onClose={() => setShowMore(false)}
        periodId={view.periodId}
        editable={!!editMeta}
        published={published}
        hasSchedule={canPublish}
        canCompleteTwelve={hasResult && !published && gaps > 0}
        running={running}
        copying={copying}
        onOpenDayNotes={() => setShowDayNotes(true)}
        onCopyLastWeek={handleCopyLastWeek}
        onCompleteTwelveHour={() => setShowProposal(true)}
        onDeleted={resetAfterDelete}
      />

      {editMeta && (
        <ScheduleEditors
          view={view}
          meta={editMeta}
          assign={assign}
          slot={slot}
          onCloseSlot={() => setSlot(null)}
          pairDay={pairDay}
          onClosePair={() => setPairDay(null)}
          showDayNotes={showDayNotes}
          onCloseDayNotes={() => setShowDayNotes(false)}
        />
      )}
    </div>
  )
}
