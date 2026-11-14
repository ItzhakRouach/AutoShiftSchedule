'use client'

import { useState } from 'react'
import { Btn } from '@/components/ui/Btn'
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
 *  published, sharing and unpublishing behind one expandable button. It opens
 *  by itself right after publishing — sharing is the next step — and stays
 *  folded on later visits. Publishing itself lives in the floating actions. */
export function PublishControls({ view, suggestions, published, onUnpublished }: Props) {
  const [open, setOpen] = useState(false)
  // Open on the false → true flip (a publish in this session), not on load.
  const [wasPublished, setWasPublished] = useState(published)
  if (published !== wasPublished) {
    setWasPublished(published)
    setOpen(published)
  }

  return (
    <div className="schedule-controls">
      <TwelveHourList suggestions={suggestions} roles={view.roles} />
      {published && (
        <>
          <div style={{ height: 14 }} />
          <Btn
            variant="outline"
            size="md"
            style={{ width: '100%' }}
            aria-expanded={open}
            data-testid="publish-tools-toggle"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'הסתרת שיתוף וביטול פרסום' : 'שיתוף הסידור וביטול פרסום'}
          </Btn>
          {open && (
            <div data-testid="publish-tools" style={{ marginTop: 10 }}>
              <ShareButton periodId={view.periodId} weekLabel={view.days[0]?.date ?? ''} shareUrl={view.imageShareUrl ?? null} />
              <UnpublishButton periodId={view.periodId} onDone={onUnpublished} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
