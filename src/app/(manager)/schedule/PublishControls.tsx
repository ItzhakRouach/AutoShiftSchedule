'use client'

import type { ScheduleView } from '@/lib/schedule/view-data'
import type { TwelveHourSuggestion } from '@/lib/scheduling/types'
import { TwelveHourList } from './parts'
import { ShareButton } from './ShareButton'
import { UnpublishButton } from './UnpublishButton'

interface Props {
  view: ScheduleView
  suggestions: TwelveHourSuggestion[]
  published: boolean
  onUnpublished: () => void
}

/** What follows the grid: the engine's 12h suggestions and, once the week is
 *  published, sharing and unpublishing. Publishing itself and deleting live in
 *  the action bar / "עוד" sheet. */
export function PublishControls({ view, suggestions, published, onUnpublished }: Props) {
  return (
    <div className="schedule-controls">
      <TwelveHourList suggestions={suggestions} roles={view.roles} />
      {published && (
        <>
          <div style={{ height: 14 }} />
          <ShareButton periodId={view.periodId} weekLabel={view.days[0]?.date ?? ''} shareUrl={view.imageShareUrl ?? null} />
          <UnpublishButton periodId={view.periodId} onDone={onUnpublished} />
        </>
      )}
    </div>
  )
}
