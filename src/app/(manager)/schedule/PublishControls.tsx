'use client'

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
  // Guard against publishing an incomplete schedule — confirm when gaps remain.
  function handlePublish() {
    if (!published) {
      const gaps = countUncoveredCells(view)
      if (gaps > 0 && !window.confirm(`נשארו ${gaps} משמרות לא מאוישות. לפרסם בכל זאת?`)) return
    }
    onPublish()
  }
  return (
    <div className="schedule-controls">
      <TwelveHourList suggestions={suggestions} roles={view.roles} />
      <div style={{ height: 14 }} />
      <Btn
        variant={published ? 'soft' : 'primary'}
        size="md"
        icon="check"
        style={{ width: '100%' }}
        disabled={publishing}
        onClick={handlePublish}
      >
        {published ? 'פורסם ✓' : publishing ? 'מפרסם…' : 'פרסם סידור'}
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
