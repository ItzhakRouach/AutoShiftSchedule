'use client'

import React from 'react'
import { SHIFT_META } from '@/lib/domain/constants'
import type { ShiftTypeRow } from '@/lib/requests/context'
import { ABSENCE_KIND_META } from '@/lib/vacations/kind-meta'
import type { DayCard } from './DayList'

interface DayChipsProps {
  day: DayCard
  shiftTypes: ShiftTypeRow[]
  isReadOnly: boolean
}

/** The chip strip inside a day card: absence chip, OR every chosen option
 *  (preferred-shift chips + a "יום חופש" chip), OR the empty placeholder. */
export function DayChips({ day, shiftTypes, isReadOnly }: DayChipsProps) {
  const r = day.request
  return (
    <>
      {day.absenceKind ? (
        <span
          data-testid="vacation-locked-chip"
          title="יום זה מסומן כהיעדרות — לא ניתן לערוך מכאן"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13.5,
            fontWeight: 700,
            color: ABSENCE_KIND_META[day.absenceKind].color,
            background: ABSENCE_KIND_META[day.absenceKind].soft,
            padding: '6px 12px',
            borderRadius: 99,
          }}
        >
          {ABSENCE_KIND_META[day.absenceKind].label}
        </span>
      ) : (r?.is_off || (r?.preferred_shift_ids.length ?? 0) > 0) ? (
        // Show EVERY chosen option: preferred shift chips AND a "יום
        // חופש" chip for a mixed "shift OR off" request.
        <>
          {shiftTypes
            .filter((st) => r?.preferred_shift_ids.includes(st.id))
            .map((st) => {
              const meta = SHIFT_META[st.key as keyof typeof SHIFT_META]
              const color = meta?.color ?? st.color
              const soft = meta?.soft ?? `${st.color}22`
              return (
                <span
                  key={st.id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 13, fontWeight: 700, color, background: soft,
                    padding: '6px 11px', borderRadius: 99,
                  }}
                >
                  {st.name}
                </span>
              )
            })}
          {r?.is_off && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13.5, fontWeight: 700, color: 'var(--vacation)',
                background: 'var(--vacation-soft)', padding: '6px 12px', borderRadius: 99,
              }}
            >
              יום חופש
            </span>
          )}
        </>
      ) : (
        <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 600 }}>
          {isReadOnly ? 'לא הוגשה בקשה' : 'טרם נבחר — הקישו להוספה'}
        </span>
      )}
    </>
  )
}
