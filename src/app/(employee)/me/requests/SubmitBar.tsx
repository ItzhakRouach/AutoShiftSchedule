'use client'

import { useState, useTransition } from 'react'
import { Btn } from '@/components/ui/Btn'
import { Icon } from '@/components/ui/Icon'
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
        border: `1px solid ${submitted ? 'rgba(19,169,142,0.35)' : 'var(--border)'}`,
        background: submitted ? 'rgba(19,169,142,0.08)' : 'var(--surface)',
        boxShadow: 'var(--shadow)',
      }}
    >
      {submitted && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon name="checkCircle" size={20} color="#13A98E" />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#13A98E' }}>הבקשות הוגשו</div>
        </div>
      )}

      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
        {submitted
          ? 'ניתן לערוך את הבקשות ולהגיש מחדש '
          : 'הבחירות נשמרות תוך כדי עריכה. לחצו כדי להגיש את הבקשות למנהל — תוכלו לערוך ולהגיש מחדש '}
        {deadlineLabel ? `עד ${deadlineLabel}.` : 'עד סגירת חלון ההגשה.'}
      </p>

      {error && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'rgba(220,70,70,0.1)', color: '#D8423B', fontSize: 14, fontWeight: 600 }}>
          {error}
        </div>
      )}

      <Btn variant="primary" size="lg" style={{ width: '100%' }} onClick={handleSubmit} disabled={isPending}>
        {isPending ? 'מגיש…' : submitted ? 'עדכון והגשה מחדש' : 'שמירה והגשה של הבקשות'}
      </Btn>
    </div>
  )
}
