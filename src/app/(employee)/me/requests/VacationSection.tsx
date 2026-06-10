'use client'

import React, { useState, useTransition } from 'react'
import { Card } from '@/components/ui/Card'
import { Btn } from '@/components/ui/Btn'
import { formatHebDate, hebrewDayName } from '@/lib/dates/week'
import type { VacationRow, VacationStatus } from '@/lib/requests/context'
import { addVacation, removeVacation } from './actions'

const STATUS_META: Record<VacationStatus, { label: string; color: string; soft: string }> = {
  pending: { label: 'ממתין לאישור', color: 'var(--warning)', soft: 'var(--warning-soft)' },
  approved: { label: 'אושר ✓', color: 'var(--success)', soft: 'var(--success-soft)' },
  rejected: { label: 'נדחה', color: 'var(--danger)', soft: 'var(--danger-soft)' },
}

function VacationStatusBadge({ status }: { status: VacationStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.pending
  return (
    <span style={{
      alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, color: m.color,
      background: m.soft, padding: '2px 9px', borderRadius: 'var(--r-pill)',
    }}>
      {m.label}
    </span>
  )
}

interface VacationSectionProps {
  employeeId: string
  vacations: VacationRow[]
  isReadOnly: boolean
}

export function VacationSection({ employeeId, vacations, isReadOnly }: VacationSectionProps) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    setAddError(null)
    startTransition(async () => {
      const result = await addVacation({ employeeId, dateFrom, dateTo })
      if ('error' in result) {
        setAddError(result.error)
      } else {
        setDateFrom('')
        setDateTo('')
      }
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      await removeVacation(id)
    })
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'var(--font)',
    minWidth: 0,
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--text)',
          marginBottom: 12,
          letterSpacing: '-0.3px',
        }}
      >
        חופשות ואי-זמינות
      </div>

      {vacations.length === 0 ? (
        <div
          style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 16, padding: '12px 0' }}
        >
          אין חופשות מוגדרות
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {vacations.map((v) => (
            <Card
              key={v.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  יום {hebrewDayName(v.date_from)} {formatHebDate(v.date_from)}
                  {v.date_from !== v.date_to && (
                    <> — יום {hebrewDayName(v.date_to)} {formatHebDate(v.date_to)}</>
                  )}
                </div>
                <VacationStatusBadge status={v.status} />
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => handleRemove(v.id)}
                  disabled={isPending}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#D8423B',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'var(--font)',
                    padding: '4px 8px',
                  }}
                >
                  הסר
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      {!isReadOnly && (
        <Card style={{ padding: '16px' }}>
          <div
            style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 12 }}
          >
            הוספת חופשה
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                // Keep "to" ≥ "from": if the chosen start is after the current
                // end (or no end yet), snap the end to the start.
                if (e.target.value && (!dateTo || dateTo < e.target.value)) setDateTo(e.target.value)
              }}
              style={inputStyle}
              aria-label="תאריך התחלה"
            />
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              style={inputStyle}
              aria-label="תאריך סיום"
            />
          </div>
          {addError && (
            <div style={{ marginBottom: 10, fontSize: 13, color: '#D8423B', fontWeight: 600 }}>
              {addError}
            </div>
          )}
          <Btn
            variant="soft"
            size="md"
            style={{ width: '100%' }}
            onClick={handleAdd}
            disabled={isPending || !dateFrom || !dateTo}
          >
            הוסף חופשה
          </Btn>
        </Card>
      )}
    </div>
  )
}
