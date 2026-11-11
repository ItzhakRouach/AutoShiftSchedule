'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import type { ShiftTypeRow, RequestRow } from '@/lib/requests/context'
import type { AbsenceKind } from '@/lib/vacations/kind-meta'
import { DayEditor } from './DayEditor'
import { DayChips } from './DayChips'
import { CapBanner } from './CapBanner'
import { capReachedExcludingActive } from '@/lib/requests/cap-check'

import { HEBREW_WEEKDAYS as HEB_DAYS } from '@/lib/dates/week'

export interface DayCard {
  dayOfWeek: number
  dateLabel: string
  request: RequestRow | null
  /** Set when this date falls in one of the employee's active absence ranges
   *  — the engine already treats it as a hard off-day; UI just reflects that. */
  absenceKind: AbsenceKind | null
}

interface DayListProps {
  days: DayCard[]
  shiftTypes: ShiftTypeRow[]
  periodId: string
  employeeId: string
  isReadOnly: boolean
  /** Workplace cap on off-days per period; `null` = ללא הגבלה. */
  maxOffDaysPerWeek: number | null
  /** Off-days the employee has ALREADY taken in this period. */
  currentOffDayCount: number
  /** EFFECTIVE cap on request days (any request counts once); `null` = ללא הגבלה
   *  (no workplace cap, or this employee is exempt). */
  maxRequestDaysPerWeek: number | null
  /** Days with a real request the employee ALREADY has in this period. */
  currentRequestDayCount: number
}

export function DayList({
  days, shiftTypes, periodId, employeeId, isReadOnly,
  maxOffDaysPerWeek, currentOffDayCount, maxRequestDaysPerWeek, currentRequestDayCount,
}: DayListProps) {
  const [editDay, setEditDay] = useState<number | null>(null)

  const activeDayCard = editDay !== null ? (days.find((d) => d.dayOfWeek === editDay) ?? null) : null
  // The active day's current state is excluded from each cap calc (the upsert
  // would replace it), so editing/clearing an existing day never reads as full.
  const activeReq = activeDayCard?.request ?? null
  const activeDayWasOff = activeReq?.is_off ?? false
  const activeDayHasRequest = activeDayWasOff || (activeReq?.preferred_shift_ids.length ?? 0) > 0
  const offCapReached = capReachedExcludingActive(maxOffDaysPerWeek, currentOffDayCount, activeDayWasOff)
  const requestCapReached = capReachedExcludingActive(
    maxRequestDaysPerWeek, currentRequestDayCount, activeDayHasRequest,
  )

  return (
    <>
      {!isReadOnly && maxRequestDaysPerWeek != null && (
        <CapBanner
          label="ימי בקשות בשבוע זה" testId="request-cap-banner"
          current={currentRequestDayCount} cap={maxRequestDaysPerWeek}
        />
      )}
      {!isReadOnly && maxOffDaysPerWeek != null && (
        <CapBanner
          label="ימי חופש בשבוע זה" testId="off-cap-banner"
          current={currentOffDayCount} cap={maxOffDaysPerWeek}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {days.map((day) => {
          const locked = isReadOnly || !!day.absenceKind
          return (
            <Card
              key={day.dayOfWeek}
              pad={0}
              interactive={!locked}
              onClick={locked ? undefined : () => setEditDay(day.dayOfWeek)}
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
                  <DayChips day={day} shiftTypes={shiftTypes} isReadOnly={isReadOnly} />
                </div>

                {!locked && (
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
            offCapReached={offCapReached}
            requestCapReached={requestCapReached}
          />
        )}
      </Sheet>
    </>
  )
}
