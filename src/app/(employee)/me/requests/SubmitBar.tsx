'use client'

import { useState, useTransition } from 'react'
import { Btn } from '@/components/ui/Btn'
import { Icon } from '@/components/ui/Icon'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { submitRequests } from './actions'

interface Props {
  periodId: string
  initialSubmittedAt: string | null
  deadlineLabel?: string | null
}

export function SubmitBar({ periodId, initialSubmittedAt, deadlineLabel }: Props) {
  const [submitted, setSubmitted] = useState(initialSubmittedAt !== null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await submitRequests(periodId)
      if ('error' in result) setError(result.error)
      else setSubmitted(true)
    })
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: '16px 18px',
        borderRadius: 'var(--r-lg)',
        border: `1px solid ${submitted ? 'var(--success)' : 'var(--border)'}`,
        background: submitted ? 'var(--success-soft)' : 'var(--surface)',
        boxShadow: 'var(--shadow)',
      }}
    >
      {submitted && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon name="checkCircle" size={20} color="var(--success)" />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>הבקשות הוגשו</div>
        </div>
      )}

      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
        {submitted
          ? 'ניתן לערוך את הבקשות ולהגיש מחדש '
          : 'הבחירות נשמרות תוך כדי עריכה. לחצו כדי להגיש את הבקשות למנהל — תוכלו לערוך ולהגיש מחדש '}
        {deadlineLabel ? `עד ${deadlineLabel}.` : 'עד סגירת חלון ההגשה.'}
      </p>

      {error && <InlineAlert kind="error">{error}</InlineAlert>}

      <Btn variant="primary" size="lg" style={{ width: '100%' }} onClick={handleSubmit} disabled={isPending}>
        {isPending ? 'מגיש…' : submitted ? 'עדכון והגשה מחדש' : 'שמירה והגשה של הבקשות'}
      </Btn>
    </div>
  )
}
