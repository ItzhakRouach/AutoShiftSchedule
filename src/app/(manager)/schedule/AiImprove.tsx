'use client'

import { useState, useTransition } from 'react'
import { Btn } from '@/components/ui/Btn'
import { Spinner } from '@/components/ui/Spinner'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { requestImprovement, applyImproved, type AiImproveResult } from './ai-improve-actions'
import { AiImproveReport } from './AiImproveReport'

/**
 * Opt-in AI pass over the FINISHED schedule. It only ever proposes swaps of two
 * filled cells, each re-checked against every hard constraint and kept only if
 * the week measurably improves — so the floor is "nothing changes". Nothing is
 * written until the manager taps אישור, and the apply step re-validates the
 * swaps server-side rather than trusting anything sent from here.
 *
 * It takes ~2-4 minutes, so it is never part of generating a schedule.
 */
export function AiImprove({ periodId }: { periodId: string }) {
  const [pending, start] = useTransition()
  const [applying, startApply] = useTransition()
  const [res, setRes] = useState<AiImproveResult | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    setError(null)
    setRes(null)
    start(async () => {
      const r = await requestImprovement(periodId)
      if (r.ok) setRes(r)
      else setError(r.error ?? 'שגיאה.')
    })
  }

  const apply = () => {
    if (!res?.swaps) return
    setError(null)
    startApply(async () => {
      const r = await applyImproved(periodId, res.swaps)
      if (r.ok) { setDone(true); setRes(null) }
      else setError(r.error ?? 'שגיאה.')
    })
  }

  if (done) {
    return (
      <InlineAlert kind="success" style={{ marginTop: 10 }}>
        השיפור הוחל על הסידור.
      </InlineAlert>
    )
  }

  const nothing = res && res.applied === 0

  return (
    <div style={{ marginTop: 10 }}>
      {!res && (
        <Btn
          variant="outline" size="md" icon="sparkles" style={{ width: '100%' }}
          disabled={pending} onClick={run} data-testid="ai-improve-btn"
        >
          {pending ? <Spinner size={16} /> : null}
          {pending ? 'ה-AI בודק שיפורים… (עד 4 דקות)' : 'בדוק שיפור עם AI'}
        </Btn>
      )}

      {error && <InlineAlert kind="error" style={{ marginTop: 10 }}>{error}</InlineAlert>}

      {res && (
        <div
          data-testid="ai-improve-panel"
          style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {nothing ? 'לא נמצא שיפור' : `נמצאו ${res.applied} החלפות משפרות`}
          </div>
          {res.notes && (
            <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.75, color: 'var(--text-2)' }}>
              {res.notes}
            </p>
          )}
          {!nothing && res.before && res.after && (
            <AiImproveReport before={res.before} after={res.after} />
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!nothing && (
              <Btn variant="primary" size="sm" disabled={applying} onClick={apply} data-testid="ai-improve-apply">
                {applying ? 'מחיל…' : 'החל על הסידור'}
              </Btn>
            )}
            <Btn variant="ghost" size="sm" onClick={() => setRes(null)}>
              {nothing ? 'סגור' : 'בטל'}
            </Btn>
          </div>
          {res.costUsd != null && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
              עלות הבדיקה: ${res.costUsd.toFixed(2)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
