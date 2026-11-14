'use client'

import { useActionState } from 'react'
import { Btn } from '@/components/ui/Btn'
import { updateRequestDeadline, type DeadlineActionState } from './actions'
import { CapNumberField } from './CapNumberField'

import { HEBREW_WEEKDAYS as DAYS_HEB } from '@/lib/dates/week'

interface Props {
  initialDow: number | null
  initialTime: string | null
  initialMaxOffPerDay: number | null
  initialMaxOffDaysPerWeek: number | null
  initialMaxRequestDaysPerWeek: number | null
}

const initialState: DeadlineActionState = {}

export function DeadlineForm({
  initialDow,
  initialTime,
  initialMaxOffPerDay,
  initialMaxOffDaysPerWeek,
  initialMaxRequestDaysPerWeek,
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
          <span style={{ color: 'var(--danger)', fontSize: 13 }}>
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
          <span style={{ color: 'var(--danger)', fontSize: 13 }}>
            {state.fieldErrors.request_deadline_time}
          </span>
        )}
      </div>

      <CapNumberField
        id="max-request-days-per-week"
        name="max_request_days_per_week"
        label="מקסימום ימי בקשות לעובד בשבוע"
        hint='כל יום עם בקשה נספר פעם אחת, גם אם נבחרו בו כמה משמרות. עובד המסומן "ללא הגבלת בקשות" אינו מוגבל.'
        min={1}
        max={7}
        defaultValue={initialMaxRequestDaysPerWeek}
        error={state.fieldErrors?.max_request_days_per_week}
      />

      <CapNumberField
        id="max-off-days-per-week"
        name="max_off_days_per_week"
        label="מקסימום ימי חופש לעובד בשבוע"
        hint='מגביל כמה ימי "חופש / לא זמין" כל עובד יכול לבקש בשבוע אחד'
        min={1}
        max={7}
        defaultValue={initialMaxOffDaysPerWeek}
        error={state.fieldErrors?.max_off_days_per_week}
      />

      <CapNumberField
        id="max-off-per-day"
        name="max_off_per_day"
        label="מקסימום חופשים ליום"
        hint="מונע מצב שבו יותר מדי עובדים מבקשים חופש באותו יום ולא ניתן לאייש אותו"
        min={1}
        max={50}
        defaultValue={initialMaxOffPerDay}
        error={state.fieldErrors?.max_off_per_day}
      />

      {state.error && (
        <p style={{ color: 'var(--danger)', fontSize: 14, margin: 0 }}>{state.error}</p>
      )}
      {state.ok && (
        <p style={{ color: 'var(--success)', fontSize: 14, margin: 0 }}>ההגדרות נשמרו בהצלחה</p>
      )}

      <Btn variant="primary" size="lg" type="submit" disabled={pending}>
        {pending ? 'שומר…' : 'שמור'}
      </Btn>
    </form>
  )
}
