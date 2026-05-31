'use client'

import { useActionState, useState } from 'react'
import { Btn } from '@/components/ui/Btn'
import { updatePublishSettings, type PublishActionState } from './publish-actions'

const DAYS_HEB = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

interface Props {
  initialDow: number | null
  initialTime: string | null
  initialInstance: string | null
  initialToken: string | null
  initialGroup: string | null
}

const initialState: PublishActionState = {}

export function PublishSettings({ initialDow, initialTime, initialInstance, initialToken, initialGroup }: Props) {
  const [state, action, pending] = useActionState(updatePublishSettings, initialState)
  const [enabled, setEnabled] = useState(
    !!(initialInstance || initialToken || initialGroup),
  )

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hidden field for greenapi_enabled */}
      <input type="hidden" name="greenapi_enabled" value={String(enabled)} />

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

      {/* GreenAPI toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
        <input
          id="greenapi-toggle" type="checkbox" checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ width: 18, height: 18, cursor: 'pointer' }}
        />
        <label htmlFor="greenapi-toggle" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
          שלח אוטומטית לווטסאפ (GreenAPI)
        </label>
      </div>

      {enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 0 4px 0' }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, lineHeight: 1.6 }}>
            GreenAPI היא שירות ווטסאפ חיצוני לא-רשמי בחינם הדורש חיבור מספר ווטסאפ.
            בלי הגדרה זו, הסידור יפורסם ויוכל להישלח ידנית בלחיצה אחת.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Instance ID</label>
            <input
              name="greenapi_instance" defaultValue={initialInstance ?? ''}
              placeholder="למשל: 1234567890"
              style={{
                padding: '9px 14px', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border-strong)', background: 'var(--surface)',
                color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font)',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>API Token</label>
            <input
              name="greenapi_token" type="password" defaultValue={initialToken ?? ''}
              placeholder="טוקן מ-GreenAPI"
              style={{
                padding: '9px 14px', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border-strong)', background: 'var(--surface)',
                color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font)',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Group ID</label>
            <input
              name="greenapi_group" defaultValue={initialGroup ?? ''}
              placeholder="מזהה קבוצה (ללא @g.us)"
              style={{
                padding: '9px 14px', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border-strong)', background: 'var(--surface)',
                color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font)',
              }}
            />
          </div>
        </div>
      )}

      {state.error && <p style={{ color: '#D8423B', fontSize: 14, margin: 0 }}>{state.error}</p>}
      {state.ok && <p style={{ color: '#13A98E', fontSize: 14, margin: 0 }}>הגדרות הפרסום נשמרו</p>}

      <Btn variant="primary" size="lg" type="submit" disabled={pending}>
        {pending ? 'שומר…' : 'שמור הגדרות פרסום'}
      </Btn>
    </form>
  )
}
