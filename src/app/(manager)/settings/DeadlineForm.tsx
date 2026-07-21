'use client'

import { useActionState } from 'react'
import { Btn } from '@/components/ui/Btn'
import { updateRequestDeadline, type DeadlineActionState } from './actions'

const DAYS_HEB = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

interface Props {
  initialDow: number | null
  initialTime: string | null
  initialMaxOffPerDay: number | null
  initialMaxOffDaysPerWeek: number | null
}

const initialState: DeadlineActionState = {}

export function DeadlineForm({
  initialDow,
  initialTime,
  initialMaxOffPerDay,
  initialMaxOffDaysPerWeek,
}: Props) {
  const [state, action, pending] = useActionState(updateRequestDeadline, initialState)

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="deadline-dow" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          יום
        </label>
        <select
          id="deadline-dow"
          name="request_deadline_dow"
          defaultValue={initialDow ?? 4}
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 15,
            fontFamily: 'var(--font)',
            cursor: 'pointer',
          }}
        >
          {DAYS_HEB.map((name, idx) => (
            <option key={idx} value={idx}>
              {name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.request_deadline_dow && (
          <span style={{ color: '#D8423B', fontSize: 13 }}>
            {state.fieldErrors.request_deadline_dow}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="deadline-time" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          שעה <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(שעון ישראל)</span>
        </label>
        <input
          id="deadline-time"
          type="time"
          name="request_deadline_time"
          defaultValue={initialTime ?? '18:00'}
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 15,
            fontFamily: 'var(--font)',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          תקופות ננעלות אוטומטית בלילה לאחר מועד זה
        </span>
        {state.fieldErrors?.request_deadline_time && (
          <span style={{ color: '#D8423B', fontSize: 13 }}>
            {state.fieldErrors.request_deadline_time}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="max-off-days-per-week" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          מקסימום ימי חופש לעובד בשבוע <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(ריק = ללא הגבלה)</span>
        </label>
        <input
          id="max-off-days-per-week"
          type="number"
          name="max_off_days_per_week"
          min={1}
          max={7}
          defaultValue={initialMaxOffDaysPerWeek ?? ''}
          placeholder="ללא הגבלה"
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 15,
            fontFamily: 'var(--font)',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          מגביל כמה ימי &quot;חופש / לא זמין&quot; כל עובד יכול לבקש בשבוע אחד
        </span>
        {state.fieldErrors?.max_off_days_per_week && (
          <span style={{ color: '#D8423B', fontSize: 13 }}>
            {state.fieldErrors.max_off_days_per_week}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="max-off-per-day" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          מקסימום חופשים ליום <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(ריק = ללא הגבלה)</span>
        </label>
        <input
          id="max-off-per-day"
          type="number"
          name="max_off_per_day"
          min={1}
          max={50}
          defaultValue={initialMaxOffPerDay ?? ''}
          placeholder="ללא הגבלה"
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 15,
            fontFamily: 'var(--font)',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          מונע מצב שבו יותר מדי עובדים מבקשים חופש באותו יום ולא ניתן לאייש אותו
        </span>
        {state.fieldErrors?.max_off_per_day && (
          <span style={{ color: '#D8423B', fontSize: 13 }}>
            {state.fieldErrors.max_off_per_day}
          </span>
        )}
      </div>

      {state.error && (
        <p style={{ color: '#D8423B', fontSize: 14, margin: 0 }}>{state.error}</p>
      )}
      {state.ok && (
        <p style={{ color: '#13A98E', fontSize: 14, margin: 0 }}>ההגדרות נשמרו בהצלחה</p>
      )}

      <Btn variant="primary" size="lg" type="submit" disabled={pending}>
        {pending ? 'שומר…' : 'שמור'}
      </Btn>
    </form>
  )
}
