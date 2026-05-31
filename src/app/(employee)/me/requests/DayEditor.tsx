'use client'

import React, { useState, useTransition } from 'react'
import { Btn } from '@/components/ui/Btn'
import { SHIFT_META } from '@/lib/domain/constants'
import type { ShiftTypeRow, RequestRow } from '@/lib/requests/context'
import { saveDayRequest, type ActionResult } from './actions'

interface DayEditorProps {
  shiftTypes: ShiftTypeRow[]
  request: RequestRow | null
  periodId: string
  employeeId: string
  dayOfWeek: number
  onDone: () => void
}

const circle = (active: boolean, color: string): React.CSSProperties => ({
  width: 24, height: 24, borderRadius: 99, flexShrink: 0,
  border: `2px solid ${active ? color : 'var(--border-strong)'}`,
  background: active ? color : 'transparent',
  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
})

export function DayEditor({ shiftTypes, request, periodId, employeeId, dayOfWeek, onDone }: DayEditorProps) {
  const [isOff, setIsOff] = useState(request?.is_off ?? false)
  const [selectedIds, setSelectedIds] = useState<string[]>(request?.preferred_shift_ids ?? [])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleShift(id: string) {
    if (isOff) return
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleOff() {
    setIsOff((prev) => !prev)
    if (!isOff) setSelectedIds([])
  }

  function handleSave() {
    startTransition(async () => {
      const result: ActionResult = await saveDayRequest({
        periodId, employeeId, dayOfWeek, isOff,
        preferredShiftIds: isOff ? [] : selectedIds,
      })
      if ('error' in result) setError(result.error)
      else onDone()
    })
  }

  return (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>
        משמרות מועדפות
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {shiftTypes.map((st) => {
          const meta = SHIFT_META[st.key as keyof typeof SHIFT_META]
          const on = !isOff && selectedIds.includes(st.id)
          const color = meta?.color ?? st.color
          const soft = meta?.soft ?? `${st.color}22`
          return (
            <button key={st.id} onClick={() => toggleShift(st.id)} style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px',
              textAlign: 'start', borderRadius: 'var(--r-md)', cursor: isOff ? 'default' : 'pointer',
              width: '100%', border: `1.5px solid ${on ? color : 'var(--border)'}`,
              background: on ? soft : 'var(--surface)', opacity: isOff ? 0.4 : 1,
              transition: 'all .12s ease', fontFamily: 'var(--font)',
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 'var(--r-sm)', background: soft, color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 13, fontWeight: 800,
              }}>
                {st.name.slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{st.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{meta?.time ?? `${st.start_hour}:00`}</div>
              </div>
              <span style={circle(on, color)}>{on && '✓'}</span>
            </button>
          )
        })}
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

      <button onClick={toggleOff} style={{
        display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px', width: '100%',
        textAlign: 'start', borderRadius: 'var(--r-md)', cursor: 'pointer',
        fontFamily: 'var(--font)', border: `1.5px solid ${isOff ? '#C0598F' : 'var(--border)'}`,
        background: isOff ? 'rgba(192,89,143,0.1)' : 'var(--surface)', transition: 'all .12s ease',
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 'var(--r-sm)', background: 'rgba(192,89,143,0.13)',
          color: '#C0598F', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✈</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>יום חופש / לא זמין</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>לא אשובץ ביום זה</div>
        </div>
        <span style={circle(isOff, '#C0598F')}>{isOff && '✓'}</span>
      </button>

      {error && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 'var(--r-md)',
          background: 'rgba(220,70,70,0.1)', color: '#D8423B', fontSize: 14, fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      <div style={{ height: 18 }} />
      <Btn variant="primary" size="lg" style={{ width: '100%' }} onClick={handleSave} disabled={isPending}>
        {isPending ? 'שומר...' : 'שמירה'}
      </Btn>
    </div>
  )
}
