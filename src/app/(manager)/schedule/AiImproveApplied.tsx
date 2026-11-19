'use client'

import { useState, useTransition } from 'react'
import { Btn } from '@/components/ui/Btn'
import { InlineAlert } from '@/components/ui/InlineAlert'
import type { DbSwap } from '@/lib/ai/swap-rows'
import { revertImproved } from './ai-improve-actions'

interface Props {
  periodId: string
  revert: DbSwap[]
  /** Error from the apply step (a partial save) — shown instead of success. */
  notice?: string | null
  /** Called once the week is back as it was (or the undo is dismissed). */
  onClear: () => void
}

/** After an AI improvement is saved: confirmation + one-tap undo of exactly
 *  those swaps. Two-step inline confirm (window.confirm is banned here). */
export function AiImproveApplied({ periodId, revert, notice, onClear }: Props) {
  const [pending, start] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const undo = () => {
    setError(null)
    start(async () => {
      const r = await revertImproved(periodId, revert)
      if (r.ok) onClear()
      else { setError(r.error ?? 'שגיאה.'); setConfirming(false) }
    })
  }

  return (
    <div style={{ marginTop: 10 }} data-testid="ai-improve-applied">
      {notice ? (
        <InlineAlert kind="warning">{notice}</InlineAlert>
      ) : (
        <InlineAlert kind="success">השיפור הוחל על הסידור ({revert.length} החלפות).</InlineAlert>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {!confirming ? (
          <Btn variant="outline" size="sm" icon="swap" onClick={() => setConfirming(true)} data-testid="ai-improve-revert">
            בטל את שינויי ה-AI
          </Btn>
        ) : (
          <>
            <Btn variant="danger" size="sm" disabled={pending} onClick={undo} data-testid="ai-improve-revert-confirm">
              {pending ? 'מבטל…' : 'כן, החזר את הסידור הקודם'}
            </Btn>
            <Btn variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
              השאר
            </Btn>
          </>
        )}
        {!confirming && (
          <Btn variant="ghost" size="sm" onClick={onClear}>
            סגור
          </Btn>
        )}
      </div>
      {error && <InlineAlert kind="error" style={{ marginTop: 8 }}>{error}</InlineAlert>}
    </div>
  )
}
