'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Btn } from '@/components/ui/Btn'
import { managerSaveDayRequest } from './request-actions'

export interface ShiftOption { id: string; name: string; color: string; soft: string }
export interface RequestEditTarget {
  employeeId: string
  employeeName: string
  dayOfWeek: number
  dayLabel: string
  isOff: boolean
  preferredShiftIds: string[]
}

/** Manager-side editor: set a worker's preferred shifts or off-day for one day. */
export function ManagerRequestEditor({
  periodId,
  target,
  shiftOptions,
  onClose,
}: {
  periodId: string
  target: RequestEditTarget
  shiftOptions: ShiftOption[]
  onClose: () => void
}) {
  const router = useRouter()
  const [isOff, setIsOff] = useState(target.isOff)
  const [selected, setSelected] = useState<string[]>(target.preferredShiftIds)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggleShift(id: string) {
    if (isOff) return
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await managerSaveDayRequest({
        periodId,
        employeeId: target.employeeId,
        dayOfWeek: target.dayOfWeek,
        isOff,
        preferredShiftIds: isOff ? [] : selected,
      })
      if ('error' in res) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--scrim)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, direction: 'rtl' }}
    >
      <div role="dialog" aria-modal="true" aria-label="עריכת בקשת משמרת" onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(420px, 100%)', background: 'var(--surface)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lift)', padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 'var(--text-h2)', fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>
          {target.employeeName}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>בקשה ליום {target.dayLabel}</div>

        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>משמרות מועדפות</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
          {shiftOptions.map((st) => {
            const on = !isOff && selected.includes(st.id)
            return (
              <button key={st.id} onClick={() => toggleShift(st.id)} style={{
                display: 'flex', alignItems: 'center', padding: '12px 14px', textAlign: 'start',
                borderRadius: 'var(--r-md)', cursor: isOff ? 'default' : 'pointer', width: '100%',
                border: `1.5px solid ${on ? st.color : 'var(--border)'}`,
                background: on ? st.soft : 'var(--surface)', opacity: isOff ? 0.4 : 1,
                fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700, color: on ? st.color : 'var(--text)',
              }}>
                {st.name}
              </button>
            )
          })}
        </div>

        <button onClick={() => { setIsOff((p) => !p); if (!isOff) setSelected([]) }} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', width: '100%', textAlign: 'start',
          borderRadius: 'var(--r-md)', cursor: 'pointer', marginBottom: 14, fontFamily: 'var(--font)',
          border: `1.5px solid ${isOff ? 'var(--vacation)' : 'var(--border)'}`,
          background: isOff ? 'var(--vacation-soft)' : 'var(--surface)',
          color: isOff ? 'var(--vacation)' : 'var(--text)', fontSize: 14, fontWeight: 700,
        }}>
          יום חופש / לא זמין
        </button>

        {error && (
          <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 'var(--r-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="outline" size="md" style={{ flex: 1 }} onClick={onClose}>ביטול</Btn>
          <Btn variant="primary" size="md" style={{ flex: 1 }} onClick={save} disabled={pending}>
            {pending ? 'שומר…' : 'שמירה'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
