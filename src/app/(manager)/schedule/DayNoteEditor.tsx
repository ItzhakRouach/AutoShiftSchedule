'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import type { ScheduleView } from '@/lib/schedule/view-data'
import { setDayNote, removeDayNote } from './day-note-actions'

const PRESETS = ['רענון', 'השתלמות', 'כונן', 'חופש']
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--r-md)',
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)',
  fontSize: 14, fontFamily: 'var(--font)',
}

export function DayNoteEditor({ open, onClose, view }: { open: boolean; onClose: () => void; view: ScheduleView }) {
  const router = useRouter()
  const [day, setDay] = useState<number | null>(null)
  const [employeeId, setEmployeeId] = useState('')
  const [label, setLabel] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, run] = useTransition()
  const empById = new Map(view.employees.map((e) => [e.id, e]))
  const notes = view.dayNotes ?? []

  function save() {
    if (day === null || !employeeId || !label.trim()) return
    setMsg(null)
    run(async () => {
      const r = await setDayNote(view.periodId, employeeId, day, label.trim())
      if (!r.ok) { setMsg(r.error ?? 'שגיאה'); return }
      setLabel(''); setEmployeeId(''); setDay(null)
      router.refresh()
    })
  }

  function remove(empId: string, d: number) {
    run(async () => {
      await removeDayNote(view.periodId, empId, d)
      router.refresh()
    })
  }

  if (!open) return null

  return (
    <Sheet open onClose={onClose} title="רענון / הערת יום">
      {msg && <div style={{ padding: '9px 12px', borderRadius: 12, background: 'rgba(220,70,70,0.1)', color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{msg}</div>}

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '4px 0 8px' }}>יום</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {view.days.map((d) => (
          <button key={d.index} data-testid={`note-day-${d.index}`} onClick={() => setDay(d.index)} style={{
            padding: '7px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', cursor: 'pointer',
            border: `1px solid ${day === d.index ? 'var(--accent)' : 'var(--border)'}`,
            background: day === d.index ? 'var(--accent-soft)' : 'var(--surface)',
            color: day === d.index ? 'var(--accent)' : 'var(--text)',
          }}>{d.short}</button>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '4px 0 8px' }}>עובד</div>
      <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ ...inputStyle, marginBottom: 14, cursor: 'pointer' }}>
        <option value="">בחרו עובד…</option>
        {view.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '4px 0 8px' }}>סוג / טקסט חופשי</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {PRESETS.map((p) => (
          <button key={p} onClick={() => setLabel(p)} style={{
            padding: '6px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font)', cursor: 'pointer',
            border: `1px solid ${label === p ? 'var(--accent)' : 'var(--border)'}`,
            background: label === p ? 'var(--accent-soft)' : 'var(--surface)',
            color: label === p ? 'var(--accent)' : 'var(--text)',
          }}>{p}</button>
        ))}
      </div>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="לדוגמה: רענון נשק" dir="rtl" style={{ ...inputStyle, marginBottom: 14 }} />

      <button data-testid="save-day-note" disabled={day === null || !employeeId || !label.trim() || busy} onClick={save} style={{
        width: '100%', padding: '11px', borderRadius: 14, fontSize: 14, fontWeight: 800, fontFamily: 'var(--font)', border: 'none',
        cursor: day === null || !employeeId || !label.trim() || busy ? 'default' : 'pointer',
        background: day === null || !employeeId || !label.trim() || busy ? 'var(--border)' : 'var(--accent)',
        color: day === null || !employeeId || !label.trim() || busy ? 'var(--text-2)' : '#fff',
      }}>{busy ? 'שומר…' : 'שבץ הערה'}</button>

      {notes.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', marginBottom: 8 }}>הערות קיימות</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notes.map((n) => (
              <div key={`${n.employeeId}:${n.day}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 12, background: 'var(--surface-2)' }}>
                <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text)' }}>
                  <b>{empById.get(n.employeeId)?.name ?? '?'}</b> · {n.label} · יום {view.days[n.day]?.short ?? n.day}
                </span>
                <button onClick={() => remove(n.employeeId, n.day)} disabled={busy} style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, lineHeight: 1, fontFamily: 'inherit' }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}
