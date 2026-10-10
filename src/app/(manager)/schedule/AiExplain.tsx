'use client'

import { useState, useTransition } from 'react'
import { Btn } from '@/components/ui/Btn'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { explainSchedulePeriod } from './ai-actions'
import { AiExplainText } from './AiExplainText'

/**
 * On-demand Hebrew explanation of the week, inside the coverage-issues popup.
 * Opt-in on purpose: it costs a few cents and takes ~30s, so it never runs as
 * part of generating a schedule. Read-only — it cannot change the schedule.
 */
export function AiExplain({ periodId }: { periodId: string }) {
  const [pending, start] = useTransition()
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)

  const run = () => {
    setError(null)
    start(async () => {
      const res = await explainSchedulePeriod(periodId)
      if (res.ok && res.text) {
        setText(res.text)
        setStale(Boolean(res.staleEdits))
      } else {
        setError(res.error ?? 'שגיאה בהפקת ההסבר.')
      }
    })
  }

  return (
    <div style={{ marginTop: 14 }}>
      {text === null && (
        <Btn
          variant="outline"
          size="sm"
          icon="sparkles"
          onClick={run}
          disabled={pending}
          data-testid="ai-explain-btn"
        >
          {pending ? 'מנתח את הסידור…' : 'הסבר מפורט (AI)'}
        </Btn>
      )}

      {error && (
        <InlineAlert kind="error" style={{ marginTop: 10 }}>
          {error}
        </InlineAlert>
      )}

      {text !== null && (
        <div
          data-testid="ai-explain-text"
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
            הסבר שנוצר ע״י AI
          </div>
          {stale && (
            <InlineAlert kind="warning" style={{ margin: '8px 0' }}>
              ההסבר מתייחס לסידור האוטומטי. עריכות ידניות שבוצעו אינן כלולות בו.
            </InlineAlert>
          )}
          <AiExplainText text={text} />
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
            נוצר אוטומטית — בדקו מול הסידור עצמו לפני שמסתמכים עליו.
          </div>
        </div>
      )}
    </div>
  )
}
