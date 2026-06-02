'use client'

import { useState, useTransition } from 'react'
import { Btn } from '@/components/ui/Btn'
import { formatShiftTime } from '@/lib/domain/meta'
import { updateShift, setShiftActive } from './shift-actions'

interface Shift {
  id: string
  key: string
  name: string
  color: string
  start_hour: number
  hours: number
  is_active: boolean
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
  padding: 24, boxShadow: 'var(--shadow)', marginBottom: 20,
}

function ShiftRow({ shift }: { shift: Shift }) {
  const [name, setName] = useState(shift.name)
  const [color, setColor] = useState(shift.color)
  const [err, setErr] = useState<string | null>(null)
  const [pending, run] = useTransition()
  const dirty = name !== shift.name || color !== shift.color

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', opacity: shift.is_active ? 1 : 0.55 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }} />
        <input value={name} onChange={(e) => setName(e.target.value)} dir="rtl" style={{ flex: 1, minWidth: 100, padding: '8px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font)' }} />
        <span style={{ fontSize: 12.5, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{formatShiftTime(shift.start_hour, shift.hours)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <span style={{ flex: 1 }} />
        {dirty && shift.is_active && (
          <Btn size="sm" variant="primary" disabled={pending} onClick={() => run(async () => {
            setErr(null)
            const r = await updateShift(shift.id, { name, startHour: shift.start_hour, hours: shift.hours, color })
            if (r.error) setErr(r.error)
          })}>שמור</Btn>
        )}
        <button
          type="button"
          onClick={() => run(async () => { const r = await setShiftActive(shift.id, !shift.is_active); if (r.error) setErr(r.error) })}
          disabled={pending}
          style={{ border: `1px solid ${shift.is_active ? 'var(--danger)' : 'var(--accent)'}`, color: shift.is_active ? 'var(--danger)' : 'var(--accent)', background: 'none', borderRadius: 'var(--r-md)', padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
        >{shift.is_active ? 'כבה משמרת' : 'הפעל משמרת'}</button>
      </div>
      {err && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '6px 0 0' }}>{err}</p>}
    </div>
  )
}

export function ShiftsSection({ shifts }: { shifts: Shift[] }) {
  return (
    <section style={sectionStyle}>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>משמרות</h2>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px', lineHeight: 1.5 }}>
        ערכו את שם המשמרת והצבע. ניתן לכבות משמרת שאינה בשימוש. (עריכת שעות תתווסף בקרוב.)
      </p>
      {shifts.map((s) => <ShiftRow key={s.id} shift={s} />)}
    </section>
  )
}
