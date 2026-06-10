'use client'

import { useActionState, useTransition, useState } from 'react'
import { Btn } from '@/components/ui/Btn'
import {
  loadIsraeliHolidays,
  addHoliday,
  removeHoliday,
  type HolidayActionState,
} from './holiday-actions'

interface HolidayRow {
  id: string
  date: string
  name: string
}

interface Props {
  holidays: HolidayRow[]
  currentYear: number
}

const initState: HolidayActionState = {}

export function HolidaysSection({ holidays, currentYear }: Props) {
  const [addState, addAction, addPending] = useActionState(addHoliday, initState)
  const [year, setYear] = useState(currentYear)
  const [loadState, setLoadState] = useState<HolidayActionState>({})
  const [removeState, setRemoveState] = useState<HolidayActionState>({})
  const [loadPending, startLoad] = useTransition()
  const [removePending, startRemove] = useTransition()

  function handleLoad() {
    startLoad(async () => {
      const res = await loadIsraeliHolidays(year)
      setLoadState(res)
    })
  }

  function handleRemove(id: string) {
    startRemove(async () => {
      const res = await removeHoliday(id)
      setRemoveState(res)
    })
  }

  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: 24,
        boxShadow: 'var(--shadow)',
        marginTop: 24,
        marginBottom: 20,
      }}
    >
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>
        לוח חגים
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.5 }}>
        חגים שיבוץ: ימי חג ועריות החג יחסמו משמרות עבור עובדים שומרי חג.
      </p>

      {/* Load Israeli holidays */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          min={2020}
          max={2040}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 15,
            width: 100,
            fontFamily: 'var(--font)',
          }}
        />
        <Btn variant="outline" size="sm" onClick={handleLoad} disabled={loadPending}>
          {loadPending ? 'טוען…' : `טען חגי ישראל לשנה ${year}`}
        </Btn>
        {loadState.ok && (
          <span style={{ color: '#13A98E', fontSize: 13 }}>החגים נטענו</span>
        )}
        {loadState.error && (
          <span style={{ color: '#D8423B', fontSize: 13 }}>{loadState.error}</span>
        )}
      </div>

      {/* Holiday list */}
      {holidays.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20 }}>אין חגים מוגדרים</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {holidays.map((h) => (
            <li
              key={h.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{h.name}</span>
                <span style={{ color: 'var(--text-2)', fontSize: 13, marginInlineStart: 8 }}>{h.date}</span>
              </div>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(h.id)}
                disabled={removePending}
              >
                הסר
              </Btn>
            </li>
          ))}
        </ul>
      )}
      {removeState.error && (
        <p style={{ color: '#D8423B', fontSize: 13, margin: '0 0 12px' }}>{removeState.error}</p>
      )}

      {/* Add custom holiday */}
      <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
          הוסף חג מותאם אישית
        </summary>
        <form
          action={addAction}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="date"
              name="date"
              required
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 15,
                fontFamily: 'var(--font)',
              }}
            />
            <input
              type="text"
              name="name"
              placeholder="שם החג"
              required
              maxLength={80}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 15,
                fontFamily: 'var(--font)',
                flex: 1,
                minWidth: 140,
              }}
            />
            <Btn variant="primary" size="sm" type="submit" disabled={addPending}>
              {addPending ? 'מוסיף…' : 'הוסף'}
            </Btn>
          </div>
          {addState.error && (
            <span style={{ color: '#D8423B', fontSize: 13 }}>{addState.error}</span>
          )}
          {addState.ok && (
            <span style={{ color: '#13A98E', fontSize: 13 }}>החג נוסף</span>
          )}
        </form>
      </details>
    </section>
  )
}
