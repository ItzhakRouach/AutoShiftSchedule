'use client'

import { useActionState } from 'react'
import { Btn } from '@/components/ui/Btn'
import { updatePublishSettings, type PublishActionState } from './publish-actions'

const DAYS_HEB = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

interface Props {
  initialDow: number | null
  initialTime: string | null
}

const initialState: PublishActionState = {}

export function PublishSettings({ initialDow, initialTime }: Props) {
  const [state, action, pending] = useActionState(updatePublishSettings, initialState)

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>יום פרסום</label>
        <select
          name="publish_dow"
          defaultValue={initialDow ?? 6}
          style={{
            padding: '10px 14px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-strong)', background: 'var(--surface)',
            color: 'var(--text)', fontSize: 15, fontFamily: 'var(--font)', cursor: 'pointer',
          }}
        >
          {DAYS_HEB.map((name, idx) => (
            <option key={idx} value={idx}>{name}</option>
          ))}
        </select>
        {state.fieldErrors?.publish_dow && (
          <span style={{ color: '#D8423B', fontSize: 13 }}>{state.fieldErrors.publish_dow}</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          שעת פרסום <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(שעון ישראל)</span>
        </label>
        <input
          type="time" name="publish_time" defaultValue={initialTime ?? '08:00'}
          style={{
            padding: '10px 14px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-strong)', background: 'var(--surface)',
            color: 'var(--text)', fontSize: 15, fontFamily: 'var(--font)',
          }}
        />
        {state.fieldErrors?.publish_time && (
          <span style={{ color: '#D8423B', fontSize: 13 }}>{state.fieldErrors.publish_time}</span>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, lineHeight: 1.6 }}>
        בתאריך ובשעה שנקבעו הסידור יפורסם אוטומטית לעובדים. לאחר הפרסום ניתן לשתף את
        תמונת הסידור לקבוצת הווטסאפ בלחיצה אחת ממסך השיבוץ.
      </p>

      {state.error && <p style={{ color: '#D8423B', fontSize: 14, margin: 0 }}>{state.error}</p>}
      {state.ok && <p style={{ color: '#13A98E', fontSize: 14, margin: 0 }}>הגדרות הפרסום נשמרו</p>}

      <Btn variant="primary" size="lg" type="submit" disabled={pending}>
        {pending ? 'שומר…' : 'שמור הגדרות פרסום'}
      </Btn>
    </form>
  )
}
