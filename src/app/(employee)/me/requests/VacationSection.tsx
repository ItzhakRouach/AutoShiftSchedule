'use client'

import React, { useState, useTransition } from 'react'
import { Card } from '@/components/ui/Card'
import { Btn } from '@/components/ui/Btn'
import { Segmented } from '@/components/ui/Segmented'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { rangesOverlap } from '@/lib/dates/ranges'
import type { VacationRow } from '@/lib/requests/context'
import { ABSENCE_KIND_OPTIONS } from '@/lib/vacations/kind-meta'
import { addVacation, removeVacation } from './vacation-actions'
import { VacationRowCard } from './VacationRowCard'

const OVERLAP_MSG = 'טווח החופשה חופף לחופשה קיימת'

interface VacationSectionProps {
  employeeId: string
  vacations: VacationRow[]
  isReadOnly: boolean
}

export function VacationSection({ employeeId, vacations, isReadOnly }: VacationSectionProps) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [kind, setKind] = useState<'vacation' | 'miluim'>('vacation')
  const [addError, setAddError] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    setAddError(null)
    // Cheap client-side pre-check against the already-rendered vacation list
    // (pending + approved both block, same as the server) — skips a round-trip
    // for the common case of picking dates that visibly overlap.
    const clientOverlap = vacations.some(
      (v) => v.status !== 'rejected' && rangesOverlap(dateFrom, dateTo, v.date_from, v.date_to),
    )
    if (clientOverlap) {
      setAddError(OVERLAP_MSG)
      return
    }
    startTransition(async () => {
      const result = await addVacation({ employeeId, dateFrom, dateTo, kind })
      if ('error' in result) {
        setAddError(result.error)
      } else {
        setDateFrom('')
        setDateTo('')
        setKind('vacation')
      }
    })
  }

  function handleRemove(id: string) {
    setRemoveError(null)
    startTransition(async () => {
      const result = await removeVacation(id)
      if ('error' in result) setRemoveError(result.error)
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 16,
    fontFamily: 'var(--font)',
    minWidth: 0,
    minHeight: 44,
  }
  const fieldLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }

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

      {removeError && (
        <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>{removeError}</div>
      )}

      {vacations.length === 0 ? (
        <div
          style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 16, padding: '12px 0' }}
        >
          אין חופשות מוגדרות
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {vacations.map((v) => (
            <VacationRowCard
              key={v.id}
              vacation={v}
              isReadOnly={isReadOnly}
              disabled={isPending}
              onRemove={handleRemove}
            />
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
          <div style={fieldLabel}>סוג היעדרות</div>
          <div style={{ marginBottom: 12 }}>
            <Segmented
              options={ABSENCE_KIND_OPTIONS.filter((o) => o.value !== 'sick')}
              value={kind}
              onChange={(v) => setKind(v as 'vacation' | 'miluim')}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={fieldLabel}>מתאריך</div>
              <input
                type="date"
                className="date-field"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  // Keep "to" ≥ "from": if the chosen start is after the current
                  // end (or no end yet), snap the end to the start.
                  if (e.target.value && (!dateTo || dateTo < e.target.value)) setDateTo(e.target.value)
                }}
                style={inputStyle}
                aria-label="מתאריך"
              />
            </label>
            <label style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={fieldLabel}>עד תאריך</div>
              <input
                type="date"
                className="date-field"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                style={inputStyle}
                aria-label="עד תאריך"
              />
            </label>
          </div>
          {addError && <InlineAlert kind="error">{addError}</InlineAlert>}
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
