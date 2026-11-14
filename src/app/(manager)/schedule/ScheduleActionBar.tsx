'use client'

import { useEffect, useRef, useState } from 'react'
import { Btn } from '@/components/ui/Btn'
import { Icon } from '@/components/ui/Icon'
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
 * The schedule's primary actions behind one small floating button, so nothing
 * sits over the grid while the manager edits. Tapping it opens publish /
 * auto-assign / more; it starts open on an empty week, where auto-assign is the
 * obvious next step and there is nothing yet to cover.
 */
export function ScheduleActionBar({ gaps, canPublish, published, publishing, checking, onPublish, onGenerate, onMore }: Props) {
  const [open, setOpen] = useState(!canPublish)
  const rootRef = useRef<HTMLDivElement>(null)
  // Put the actions away when the manager goes back to the grid. A listener
  // rather than a backdrop, so that same tap still lands on the cell.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])
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
    onPublish() // stays open so the "פורסם ✓" result is seen
  }
  const closeThen = (fn: () => void) => () => { setOpen(false); fn() }

  const publishLabel = published
    ? 'פורסם ✓'
    : publishing
    ? 'מפרסם…'
    : confirmGaps !== null
    ? `נשארו ${confirmGaps} לא מאוישות — לחצו שוב לפרסום`
    : 'פרסום הסידור'

  return (
    <div ref={rootRef} className="sched-fab" data-testid="schedule-actionbar">
      {open && (
          <div
            id="schedule-actions"
            style={{
              position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, width: 'min(280px, calc(100vw - 32px))',
              padding: 10, borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
              background: 'var(--surface)', boxShadow: 'var(--shadow-lift)',
            }}
          >
            {canPublish && (
              <Btn
                variant={published ? 'soft' : confirmGaps !== null ? 'danger' : 'primary'}
                size="md"
                icon={confirmGaps !== null ? undefined : 'check'}
                style={{ width: '100%' }}
                disabled={publishing}
                onClick={handlePublish}
              >
                {publishLabel}
              </Btn>
            )}
            <Btn variant={canPublish ? 'outline' : 'primary'} size="md" style={{ width: '100%' }} disabled={checking} onClick={closeThen(onGenerate)}>
              {checking ? <Spinner size={16} /> : null}
              {checking ? 'רגע…' : 'שיבוץ אוטומטי'}
            </Btn>
            <Btn variant="outline" size="md" style={{ width: '100%' }} onClick={closeThen(onMore)} data-testid="more-actions">
              פעולות נוספות
            </Btn>
          </div>
      )}

      <button
        type="button"
        data-testid="schedule-actions-toggle"
        aria-expanded={open}
        aria-controls="schedule-actions"
        aria-label="פעולות הסידור"
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative', alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 48, padding: '0 16px', borderRadius: 'var(--r-pill)', cursor: 'pointer', fontFamily: 'var(--font)',
          border: 'none', background: 'var(--accent)', color: 'var(--accent-ink)',
          fontSize: 'var(--text-body)', fontWeight: 700, boxShadow: 'var(--shadow-lift)',
        }}
      >
        <Icon name={open ? 'x' : 'check'} size={18} stroke={2.4} />
        {open ? 'סגירה' : 'פעולות'}
      </button>
    </div>
  )
}
