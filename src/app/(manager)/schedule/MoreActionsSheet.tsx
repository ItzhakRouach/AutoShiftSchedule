'use client'

import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Btn } from '@/components/ui/Btn'
import { DeleteScheduleButton } from './DeleteScheduleButton'

interface Props {
  open: boolean
  onClose: () => void
  periodId: string
  /** Manager can edit this week (false on a read-only view). */
  editable: boolean
  published: boolean
  /** Assignments exist or the week is published — there is something to delete. */
  hasSchedule: boolean
  /** Gaps remain that a 12h pass could close. */
  canCompleteTwelve: boolean
  running: boolean
  copying: boolean
  onOpenDayNotes: () => void
  onCopyLastWeek: () => void
  onCompleteTwelveHour: () => void
  onDeleted: () => void
}

const hint: React.CSSProperties = { margin: '4px 2px 0', fontSize: 'var(--text-sm)', color: 'var(--text-2)' }

/** The schedule actions a manager needs only now and then, each with a line
 *  saying what it does — kept off the page so the grid stays in view. */
export function MoreActionsSheet({
  open, onClose, periodId, editable, published, hasSchedule, canCompleteTwelve, running, copying,
  onOpenDayNotes, onCopyLastWeek, onCompleteTwelveHour, onDeleted,
}: Props) {
  // Two-step inline confirm for copy-last-week (replaces existing same-day
  // assignments) — no window.confirm, same pattern as publishing with gaps.
  const [confirmCopy, setConfirmCopy] = useState(false)
  function handleCopyClick() {
    if (!confirmCopy) {
      setConfirmCopy(true)
      window.setTimeout(() => setConfirmCopy(false), 6000)
      return
    }
    setConfirmCopy(false)
    onCopyLastWeek()
    onClose()
  }
  const then = (fn: () => void) => () => { onClose(); fn() }

  return (
    <Sheet open={open} onClose={onClose} title="פעולות נוספות" testId="more-actions-sheet">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {editable && (
          <div>
            <Btn variant="outline" size="md" icon="bell" style={{ width: '100%' }} onClick={then(onOpenDayNotes)}>
              שמירת עובד ליום (רענון)
            </Btn>
            <p style={hint}>מסמנים עובד שלא ישובץ ביום מסוים, לפני השיבוץ האוטומטי.</p>
          </div>
        )}

        {editable && !published && (
          <div>
            <Btn variant={confirmCopy ? 'danger' : 'outline'} size="md" icon="calendar" style={{ width: '100%' }} disabled={copying} onClick={handleCopyClick} data-testid="copy-last-week">
              {copying ? 'מעתיק…' : confirmCopy ? 'שיבוצים קיימים יוחלפו — לחצו שוב לאישור' : 'העתקה מהשבוע הקודם'}
            </Btn>
            <p style={hint}>מעתיק את השיבוצים של השבוע הקודם לשבוע הזה.</p>
          </div>
        )}

        {canCompleteTwelve && (
          <div>
            <Btn variant="soft" size="md" style={{ width: '100%' }} disabled={running} onClick={then(onCompleteTwelveHour)} data-testid="complete-twelve">
              השלמה עם משמרות 12 שעות
            </Btn>
            <p style={hint}>ממלא משבצות שנשארו ריקות בעזרת משמרות של 12 שעות. שיבוצים ידניים נשמרים.</p>
          </div>
        )}

        {hasSchedule && <DeleteScheduleButton periodId={periodId} onDone={then(onDeleted)} />}
      </div>
    </Sheet>
  )
}
