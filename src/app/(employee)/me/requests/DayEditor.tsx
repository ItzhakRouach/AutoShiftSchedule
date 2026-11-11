'use client'

import React, { useState, useTransition } from 'react'
import { Btn } from '@/components/ui/Btn'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { LtrText } from '@/components/ui/LtrText'
import { SHIFT_META } from '@/lib/domain/constants'
import type { ShiftTypeRow, RequestRow } from '@/lib/requests/context'
import { saveDayRequest } from './actions'
import type { ActionResult } from './request-helpers'

interface DayEditorProps {
  shiftTypes: ShiftTypeRow[]
  request: RequestRow | null
  periodId: string
  employeeId: string
  dayOfWeek: number
  onDone: () => void
  /** True when the workplace's max-off-days cap is reached EXCLUDING this day. */
  offCapReached: boolean
  /** True when the weekly request-day cap is reached EXCLUDING this day. */
  requestCapReached: boolean
}

const circle = (active: boolean, color: string): React.CSSProperties => ({
  width: 24, height: 24, borderRadius: 99, flexShrink: 0,
  border: `2px solid ${active ? color : 'var(--border-strong)'}`,
  background: active ? color : 'transparent',
  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
})

export function DayEditor({
  shiftTypes, request, periodId, employeeId, dayOfWeek, onDone, offCapReached, requestCapReached,
}: DayEditorProps) {
  const [isOff, setIsOff] = useState(request?.is_off ?? false)
  const [selectedIds, setSelectedIds] = useState<string[]>(request?.preferred_shift_ids ?? [])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // An already-saved day (a REAL request: off or shifts — same predicate the
  // server's cap check uses) with nothing selected means this save will CLEAR
  // it (see actions.ts) rather than being a no-op.
  const hasSavedRow = request !== null && (request.is_off || request.preferred_shift_ids.length > 0)
  const isEmpty = !isOff && selectedIds.length === 0

  // Request-day cap: a NEW day can't be requested once the cap is full, but a
  // day that already holds a request can always be edited or cleared.
  const capBlocksNew = requestCapReached && !hasSavedRow
  // Disable the off-button when the workplace cap is reached AND this day is
  // not already marked off (toggling OFF an existing off-day is always allowed).
  const offDisabled = capBlocksNew || (offCapReached && !isOff)

  // Shifts and "day off" are independent, combinable preferences: e.g. pick
  // morning AND off → "give me morning, or a day off". The engine satisfies any
  // selected option. (Selecting nothing + off = a plain off-request.)
  function toggleShift(id: string) {
    if (capBlocksNew) return
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleOff() {
    if (offDisabled) return
    setIsOff((prev) => !prev)
  }

  function handleSave() {
    startTransition(async () => {
      const result: ActionResult = await saveDayRequest({
        periodId, employeeId, dayOfWeek, isOff,
        preferredShiftIds: selectedIds,
      })
      if ('error' in result) setError(result.error)
      else onDone()
    })
  }

  return (
    <div>
      {capBlocksNew && (
        <InlineAlert kind="info" style={{ marginBottom: 14 }}>
          הגעת למקסימום ימי בקשות לשבוע — נקו יום אחר כדי לבקש כאן
        </InlineAlert>
      )}
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
        משמרות מועדפות
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
        ניתן לבחור כמה משמרות וגם &quot;יום חופש&quot; יחד — הסידור ייתן אחת מהאפשרויות שבחרת
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {shiftTypes.map((st) => {
          const meta = SHIFT_META[st.key as keyof typeof SHIFT_META]
          const on = selectedIds.includes(st.id)
          const color = meta?.color ?? st.color
          const soft = meta?.soft ?? `${st.color}22`
          return (
            <button key={st.id} onClick={() => toggleShift(st.id)} disabled={capBlocksNew} style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px',
              textAlign: 'start', borderRadius: 'var(--r-md)',
              cursor: capBlocksNew ? 'not-allowed' : 'pointer', opacity: capBlocksNew ? 0.45 : 1,
              width: '100%', border: `1.5px solid ${on ? color : 'var(--border)'}`,
              background: on ? soft : 'var(--surface)',
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
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}><LtrText>{meta?.time ?? `${st.start_hour}:00`}</LtrText></div>
              </div>
              <span style={circle(on, color)}>{on && '✓'}</span>
            </button>
          )
        })}
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

      <button onClick={toggleOff} disabled={offDisabled} style={{
        display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px', width: '100%',
        textAlign: 'start', borderRadius: 'var(--r-md)',
        cursor: offDisabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font)', border: `1.5px solid ${isOff ? 'var(--vacation)' : 'var(--border)'}`,
        background: isOff ? 'var(--vacation-soft)' : 'var(--surface)',
        opacity: offDisabled ? 0.45 : 1, transition: 'all .12s ease',
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 'var(--r-sm)', background: 'var(--vacation-soft)',
          color: 'var(--vacation)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✈</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>יום חופש / לא זמין</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {capBlocksNew ? 'הגעת למקסימום ימי בקשות לשבוע'
              : offDisabled ? 'הגעת למקסימום ימי חופש לשבוע' : 'לא אשובץ ביום זה'}
          </div>
        </div>
        <span style={circle(isOff, 'var(--vacation)')}>{isOff && '✓'}</span>
      </button>

      {error && <InlineAlert kind="error" style={{ marginTop: 12, marginBottom: 0 }}>{error}</InlineAlert>}

      <div style={{ height: 18 }} />
      <Btn
        variant={isEmpty && hasSavedRow ? 'soft' : 'primary'}
        size="lg"
        style={{ width: '100%' }}
        onClick={handleSave}
        disabled={isPending || capBlocksNew || (isEmpty && !hasSavedRow)}
      >
        {isEmpty && hasSavedRow
          ? (isPending ? 'מנקה…' : 'נקה יום')
          : (isPending ? 'שומר...' : 'שמירה')}
      </Btn>
      {isEmpty && !hasSavedRow && !isPending && !capBlocksNew && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
          יש לבחור משמרת אחת לפחות או לסמן יום חופש
        </div>
      )}
    </div>
  )
}
