'use client'

import { useState } from 'react'
import { Btn } from '@/components/ui/Btn'
import { Spinner } from '@/components/ui/Spinner'

interface Props {
  /** Unfilled required cells right now — publishing with gaps asks twice. */
  gaps: number
  /** There is something to publish (assignments exist, or it is already published). */
  canPublish: boolean
  published: boolean
  publishing: boolean
  checking: boolean
  onPublish: () => void
  onGenerate: () => void
  onMore: () => void
}

/**
 * The schedule's primary actions, pinned to the bottom of the screen so
 * publishing and auto-assigning are always one tap away however long the grid
 * is. Everything less common lives behind "עוד" (MoreActionsSheet).
 */
export function ScheduleActionBar({ gaps, canPublish, published, publishing, checking, onPublish, onGenerate, onMore }: Props) {
  // Guard against publishing an incomplete schedule — inline two-step confirm
  // when gaps remain (no window.confirm: clunky on mobile, breaks RTL, and is
  // auto-dismissed in e2e).
  const [confirmGaps, setConfirmGaps] = useState<number | null>(null)

  function handlePublish() {
    if (!published && confirmGaps === null && gaps > 0) {
      setConfirmGaps(gaps)
      // Reset confirm-state after 6s so a stray click doesn't linger.
      window.setTimeout(() => setConfirmGaps(null), 6000)
      return
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
    : 'פרסום הסידור'

  return (
    <div className="sched-actionbar" data-testid="schedule-actionbar" style={{ flexWrap: confirmGaps !== null ? 'wrap' : 'nowrap' }}>
      {canPublish && (
        <Btn
          variant={published ? 'soft' : confirmGaps !== null ? 'danger' : 'primary'}
          size="md"
          icon={confirmGaps !== null ? undefined : 'check'}
          style={{ flex: '1.4 1 0', minWidth: 0, whiteSpace: confirmGaps !== null ? 'normal' : 'nowrap', paddingInline: 12 }}
          disabled={publishing}
          onClick={handlePublish}
        >
          {publishLabel}
        </Btn>
      )}
      <Btn variant={canPublish ? 'outline' : 'primary'} size="md" style={{ flex: '1 1 0', minWidth: 0, whiteSpace: 'nowrap', paddingInline: 12 }} disabled={checking} onClick={onGenerate}>
        {checking ? <Spinner size={16} /> : null}
        {checking ? 'רגע…' : 'שיבוץ אוטומטי'}
      </Btn>
      <Btn variant="outline" size="md" style={{ flex: '0 0 auto', paddingInline: 14 }} onClick={onMore} data-testid="more-actions">
        עוד
      </Btn>
    </div>
  )
}
