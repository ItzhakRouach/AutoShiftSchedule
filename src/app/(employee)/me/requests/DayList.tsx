'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { SHIFT_META } from '@/lib/domain/constants'
import type { ShiftTypeRow, RequestRow } from '@/lib/requests/context'
import { DayEditor } from './DayEditor'

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

interface DayCard {
  dayOfWeek: number
  dateLabel: string
  request: RequestRow | null
}

interface DayListProps {
  days: DayCard[]
  shiftTypes: ShiftTypeRow[]
  periodId: string
  employeeId: string
  isReadOnly: boolean
}

export function DayList({ days, shiftTypes, periodId, employeeId, isReadOnly }: DayListProps) {
  const [editDay, setEditDay] = useState<number | null>(null)

  const activeDayCard = editDay !== null ? (days.find((d) => d.dayOfWeek === editDay) ?? null) : null

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {days.map((day) => {
          const r = day.request
          return (
            <Card
              key={day.dayOfWeek}
              pad={0}
              interactive={!isReadOnly}
              onClick={isReadOnly ? undefined : () => setEditDay(day.dayOfWeek)}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px' }}>
                <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                    {HEB_DAYS[day.dayOfWeek]}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                    {day.dateLabel}
                  </div>
                </div>

                <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />

                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  {r?.is_off ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#C0598F',
                        background: 'rgba(192,89,143,0.12)',
                        padding: '6px 12px',
                        borderRadius: 99,
                      }}
                    >
                      יום חופש
                    </span>
                  ) : r && r.preferred_shift_ids.length > 0 ? (
                    shiftTypes
                      .filter((st) => r.preferred_shift_ids.includes(st.id))
                      .map((st) => {
                        const meta = SHIFT_META[st.key as keyof typeof SHIFT_META]
                        const color = meta?.color ?? st.color
                        const soft = meta?.soft ?? `${st.color}22`
                        return (
                          <span
                            key={st.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 13,
                              fontWeight: 700,
                              color,
                              background: soft,
                              padding: '6px 11px',
                              borderRadius: 99,
                            }}
                          >
                            {st.name}
                          </span>
                        )
                      })
                  ) : (
                    <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 600 }}>
                      {isReadOnly ? 'לא הוגשה בקשה' : 'טרם נבחר — הקישו להוספה'}
                    </span>
                  )}
                </div>

                {!isReadOnly && (
                  <Icon name="chevronLeft" size={18} color="var(--text-3)" />
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <Sheet
        open={editDay !== null}
        onClose={() => setEditDay(null)}
        title={
          activeDayCard
            ? `${HEB_DAYS[activeDayCard.dayOfWeek]} · ${activeDayCard.dateLabel}`
            : ''
        }
      >
        {editDay !== null && activeDayCard !== null && (
          <DayEditor
            shiftTypes={shiftTypes}
            request={activeDayCard.request}
            periodId={periodId}
            employeeId={employeeId}
            dayOfWeek={editDay}
            onDone={() => setEditDay(null)}
          />
        )}
      </Sheet>
    </>
  )
}
