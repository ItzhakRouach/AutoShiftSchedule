'use client'

import { useState } from 'react'
import { Btn } from '@/components/ui/Btn'
import { Spinner } from '@/components/ui/Spinner'
import { countUncoveredCells } from '@/lib/schedule/week-table-data'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { EditMeta } from '@/lib/schedule/edit-meta'

interface Props {
  view: ScheduleView
  editMeta: EditMeta | null
  status: string
  hasResult: boolean
  checking: boolean
  running: boolean
  onOpenDayNotes: () => void
  onGenerateClick: () => void
  onCompleteTwelveHour: () => void
  onCopyLastWeek: () => void
  copying: boolean
}

/**
 * The generate-schedule controls: optional "רענון" shortcut, the primary
 * 8h-only "צור סידור אוטומטי" button, and — once a result exists and gaps
 * remain — the secondary "השלם 12ש׳ אוטומטית" button that re-runs WITH the
 * 12h pass (manual edits preserved). Split out of ScheduleClient to stay
 * within the ≤200-line file budget.
 */
export function GenerateControls({
  view, editMeta, status, hasResult, checking, running,
  onOpenDayNotes, onGenerateClick, onCompleteTwelveHour, onCopyLastWeek, copying,
}: Props) {
  const showComplete = hasResult && status !== 'published' && countUncoveredCells(view) > 0

  // Two-step inline confirm for copy-last-week (replaces existing same-day
  // assignments) — no window.confirm: clunky on mobile, breaks RTL, and is
  // auto-dismissed in e2e.
  const [confirmCopy, setConfirmCopy] = useState(false)
  function handleCopyClick() {
    if (!confirmCopy) {
      setConfirmCopy(true)
      window.setTimeout(() => setConfirmCopy(false), 6000)
      return
    }
    setConfirmCopy(false)
    onCopyLastWeek()
  }

  return (
    <>
      {editMeta && (
        <>
          <div style={{ height: 10 }} />
          <Btn variant="outline" size="md" icon="bell" style={{ width: '100%' }} onClick={onOpenDayNotes}>
            רענון / שמירת עובד ליום (לפני יצירה)
          </Btn>
        </>
      )}

      <div style={{ height: 12 }} />
      <Btn variant="primary" size="lg" icon={checking ? undefined : 'check'} style={{ width: '100%' }} disabled={checking} onClick={onGenerateClick}>
        {checking ? <Spinner size={18} color="#fff" /> : null}
        {checking ? 'רגע…' : 'צור סידור אוטומטי'}
      </Btn>

      {editMeta && status !== 'published' && (
        <>
          <div style={{ height: 10 }} />
          <Btn variant={confirmCopy ? 'danger' : 'outline'} size="md" icon="calendar" style={{ width: '100%' }} disabled={copying} onClick={handleCopyClick} data-testid="copy-last-week">
            {copying ? 'מעתיק…' : confirmCopy ? 'שיבוצים קיימים יוחלפו — לחצו שוב לאישור' : 'העתק מהשבוע הקודם'}
          </Btn>
        </>
      )}

      {showComplete && (
        <>
          <div style={{ height: 10 }} />
          <Btn
            variant="soft"
            size="md"
            style={{ width: '100%' }}
            disabled={running}
            onClick={onCompleteTwelveHour}
            data-testid="complete-twelve"
          >
            השלם 12ש׳ אוטומטית
          </Btn>
        </>
      )}
    </>
  )
}
