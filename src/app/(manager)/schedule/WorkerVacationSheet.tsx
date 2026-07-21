'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { Btn } from '@/components/ui/Btn'
import { Segmented } from '@/components/ui/Segmented'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { formatHebDate, hebrewDayName } from '@/lib/dates/week'
import { rangesOverlap } from '@/lib/dates/ranges'
import type { WorkplaceVacation, VacationKind, VacationStatus } from '@/lib/vacations/pending'
import { ABSENCE_KIND_META, ABSENCE_KIND_OPTIONS } from '@/lib/vacations/kind-meta'
import { addWorkerVacation, removeWorkerVacation } from './vacation-actions'

const OVERLAP_MSG = 'הטווח חופף להיעדרות קיימת'

const STATUS_META: Record<VacationStatus, { label: string; color: string; soft: string }> = {
  pending: { label: 'ממתין לאישור', color: 'var(--warning)', soft: 'var(--warning-soft)' },
  approved: { label: 'אושר ✓', color: 'var(--success)', soft: 'var(--success-soft)' },
  rejected: { label: 'נדחה', color: 'var(--danger)', soft: 'var(--danger-soft)' },
}

function Chip({ color, soft, label }: { color: string; soft: string; label: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: soft, padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
      {label}
    </span>
  )
}

function rangeLabel(dateFrom: string, dateTo: string): string {
  const from = `יום ${hebrewDayName(dateFrom)} ${formatHebDate(dateFrom)}`
  if (dateFrom === dateTo) return from
  return `${from} — יום ${hebrewDayName(dateTo)} ${formatHebDate(dateTo)}`
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--r-md)',
  border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font)', minWidth: 0,
}

const fieldLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }

interface Props {
  employeeId: string
  employeeName: string
  vacations: WorkplaceVacation[]
  onClose: () => void
}

/** Manager-side sheet: add/remove a worker's היעדרות (absence) range — vacation,
 *  מילואים or מחלה — from the schedule "בקשות עובדים" view. Mirrors
 *  VacationSection's employee-side UX, split into its own file to keep
 *  RequestsOverviewRow ≤200 lines. */
export function WorkerVacationSheet({ employeeId, employeeName, vacations, onClose }: Props) {
  const router = useRouter()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [kind, setKind] = useState<VacationKind>('vacation')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    setError(null)
    setSaved(false)
    const clientOverlap = vacations.some(
      (v) => v.status !== 'rejected' && rangesOverlap(dateFrom, dateTo, v.dateFrom, v.dateTo),
    )
    if (clientOverlap) {
      setError(OVERLAP_MSG)
      return
    }
    startTransition(async () => {
      const result = await addWorkerVacation(employeeId, dateFrom, dateTo, kind)
      if ('error' in result) {
        setError(result.error)
      } else {
        setDateFrom('')
        setDateTo('')
        setSaved(true)
        router.refresh() // pulls the freshly-inserted row into workerVacations
      }
    })
  }

  function handleRemove(id: string) {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await removeWorkerVacation(id)
      if ('error' in result) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <Sheet open onClose={onClose} title={`היעדרות — ${employeeName}`}>
      {vacations.length === 0 ? (
        <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 16, padding: '8px 0' }}>
          אין היעדרויות מוגדרות
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {vacations.map((v) => (
            <div
              key={v.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                  {rangeLabel(v.dateFrom, v.dateTo)}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Chip {...STATUS_META[v.status]} />
                  {v.kind !== 'vacation' && <Chip {...ABSENCE_KIND_META[v.kind]} />}
                </div>
              </div>
              <button
                onClick={() => handleRemove(v.id)}
                disabled={isPending}
                style={{
                  border: 'none', background: 'transparent', color: 'var(--danger)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', padding: '4px 8px',
                }}
              >
                הסר
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>
        הוספת היעדרות
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>
        סוג היעדרות
      </div>
      <div style={{ marginBottom: 12 }}>
        <Segmented options={ABSENCE_KIND_OPTIONS} value={kind} onChange={(v) => setKind(v as VacationKind)} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={fieldLabel}>מתאריך</div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
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
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            style={inputStyle}
            aria-label="עד תאריך"
          />
        </label>
      </div>
      {error && <InlineAlert kind="error">{error}</InlineAlert>}
      {saved && !error && <InlineAlert kind="success">נשמר ✓</InlineAlert>}
      <Btn
        variant="soft"
        size="md"
        style={{ width: '100%' }}
        onClick={handleAdd}
        disabled={isPending || !dateFrom || !dateTo}
      >
        הוסף היעדרות
      </Btn>
    </Sheet>
  )
}
