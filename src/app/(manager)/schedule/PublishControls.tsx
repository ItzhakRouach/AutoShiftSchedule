'use client'

import { useState } from 'react'
import { Btn } from '@/components/ui/Btn'
import { countUncoveredCells } from '@/lib/schedule/week-table-data'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { TwelveHourSuggestion } from '@/lib/scheduling/types'
import { TwelveHourList } from './parts'
import { ShareButton } from './ShareButton'
import { UnpublishButton } from './UnpublishButton'
import { DeleteScheduleButton } from './DeleteScheduleButton'

interface Props {
  view: ScheduleView
  suggestions: TwelveHourSuggestion[]
  published: boolean
  publishing: boolean
  onPublish: () => void
  onUnpublished: () => void
  onDeleted: () => void
}

/** Publish / share / unpublish / delete controls beneath the schedule grid.
 *  Split out of ScheduleClient to keep that orchestrator ≤200 lines. */
export function PublishControls({ view, suggestions, published, publishing, onPublish, onUnpublished, onDeleted }: Props) {
  // Guard against publishing an incomplete schedule — inline two-step confirm
  // when gaps remain (same pattern as UnpublishButton; no window.confirm,
  // which is clunky on mobile, breaks RTL, and is auto-dismissed in e2e).
  const [confirmGaps, setConfirmGaps] = useState<number | null>(null)

  function handlePublish() {
    if (!published && confirmGaps === null) {
      const gaps = countUncoveredCells(view)
      if (gaps > 0) {
        setConfirmGaps(gaps)
        // Reset confirm-state after 6s so a stray click doesn't linger.
        window.setTimeout(() => setConfirmGaps(null), 6000)
        return
      }
    }
    setConfirmGaps(null)
    onPublish()
  }

  const publishLabel = published
    ? 'פורסם ✓'
    : publishing
    ? 'מפרסם…'
    : confirmGaps !== null
    ? `נשארו ${confirmGaps} לא מאוישות — לחצו שוב לפרסום`
    : 'פרסם סידור'

  return (
    <div className="schedule-controls">
      <TwelveHourList suggestions={suggestions} roles={view.roles} />
      <div style={{ height: 14 }} />
      <Btn
        variant={published ? 'soft' : confirmGaps !== null ? 'danger' : 'primary'}
        size="md"
        icon="check"
        style={{ width: '100%' }}
        disabled={publishing}
        onClick={handlePublish}
      >
        {publishLabel}
      </Btn>
      {published && (
        <>
          <div style={{ height: 10 }} />
          <ShareButton periodId={view.periodId} weekLabel={view.days[0]?.date ?? ''} shareUrl={view.imageShareUrl ?? null} />
          <UnpublishButton periodId={view.periodId} onDone={onUnpublished} />
        </>
      )}
      <DeleteScheduleButton periodId={view.periodId} onDone={onDeleted} />
    </div>
  )
}
