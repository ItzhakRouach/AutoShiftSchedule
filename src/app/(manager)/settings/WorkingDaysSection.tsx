'use client'

import { useState, useTransition } from 'react'
import { Btn } from '@/components/ui/Btn'
import { setWorkingDays } from './requirements-actions'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

export function WorkingDaysSection({ initialDays }: { initialDays: number[] }) {
  const [days, setDays] = useState<Set<number>>(new Set(initialDays))
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [pending, start] = useTransition()

  function toggle(d: number) {
    setStatus('idle')
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 24, boxShadow: 'var(--shadow)', marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>ימי עבודה</h2>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px', lineHeight: 1.5 }}>
        בחרו באילו ימים יש עבודה. בימים שאינם מסומנים לא ישובצו עובדים.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {DAY_NAMES.map((label, d) => {
          const on = days.has(d)
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              style={{
                padding: '8px 14px', borderRadius: 'var(--r-pill)', cursor: 'pointer', fontFamily: 'var(--font)',
                fontSize: 14, fontWeight: on ? 700 : 600,
                border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--accent-soft)' : 'var(--surface)',
                color: on ? 'var(--accent)' : 'var(--text-2)',
              }}
            >{label}</button>
          )
        })}
      </div>

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Btn
          variant="primary" size="sm" disabled={pending || days.size === 0}
          onClick={() => start(async () => {
            const r = await setWorkingDays([...days].sort((a, b) => a - b))
            if (r.ok) setStatus('ok')
            else { setStatus('error'); setErrorMsg(r.error ?? 'שגיאה') }
          })}
        >{pending ? 'שומר…' : 'שמירה'}</Btn>
        {status === 'ok' && <span style={{ fontSize: 13, color: '#13A98E', fontWeight: 600 }}>נשמר בהצלחה</span>}
        {status === 'error' && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{errorMsg}</span>}
      </div>
    </section>
  )
}
