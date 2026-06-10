'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import { isInVacationRange } from '@/lib/dates/week'
import type { ScheduleView, ViewEmployee, ViewRequest, ViewVacation } from '@/lib/schedule/view-data'
import { ManagerRequestEditor, type ShiftOption, type RequestEditTarget } from './ManagerRequestEditor'
import { managerClearAllRequests } from './request-actions'

interface Props {
  view: ScheduleView
}

const BASE_KEYS = ['morning', 'noon', 'night'] as const

const clearBtn = (danger: boolean): React.CSSProperties => ({
  fontSize: 12.5, fontWeight: 700, padding: '5px 12px', borderRadius: 'var(--r-pill)',
  border: `1px solid ${danger ? 'var(--danger)' : 'var(--border-strong)'}`,
  background: danger ? 'var(--danger-soft)' : 'var(--surface)',
  color: danger ? 'var(--danger)' : 'var(--text-2)', cursor: 'pointer', fontFamily: 'var(--font)',
})

/** Build a lookup: employeeId → dayOfWeek → ViewRequest */
function buildRequestMap(
  requests: ViewRequest[],
): Map<string, Map<number, ViewRequest>> {
  const map = new Map<string, Map<number, ViewRequest>>()
  for (const r of requests) {
    let byDay = map.get(r.employeeId)
    if (!byDay) { byDay = new Map(); map.set(r.employeeId, byDay) }
    byDay.set(r.dayOfWeek, r)
  }
  return map
}

/** Employees that have at least one request row. */
function submittedCount(employees: ViewEmployee[], reqMap: Map<string, Map<number, ViewRequest>>): number {
  return employees.filter((e) => (reqMap.get(e.id)?.size ?? 0) > 0).length
}

function ShiftChip({ shiftTypeId, shiftTypeIdByKey }: { shiftTypeId: string; shiftTypeIdByKey: Record<string, string> }) {
  const entry = Object.entries(shiftTypeIdByKey).find(([, id]) => id === shiftTypeId)
  if (!entry) return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{shiftTypeId.slice(0, 6)}</span>
  const [key] = entry
  const meta = SHIFT_META[key as keyof typeof SHIFT_META]
  if (!meta) return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{key}</span>
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        borderRadius: 'var(--r-pill)',
        background: meta.soft,
        color: meta.color,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        marginBottom: 2,
      }}
    >
      {meta.name}
    </span>
  )
}

function DayCell({ req, shiftTypeIdByKey, onVacation, onClick }: { req: ViewRequest | undefined; shiftTypeIdByKey: Record<string, string>; onVacation: boolean; onClick?: () => void }) {
  const cellStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderLeft: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
    textAlign: 'center',
    verticalAlign: 'middle',
    minWidth: 80,
    cursor: onClick ? 'pointer' : 'default',
  }
  if (onVacation) {
    return (
      <td
        data-testid="vacation-cell"
        title="העובד בחופשה ביום זה"
        style={{ ...cellStyle, background: 'var(--vacation-soft)' }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--vacation)' }}>🌴 חופשה</span>
      </td>
    )
  }
  if (!req) {
    return <td style={cellStyle} onClick={onClick} title="לחצו לעריכת הבקשה"><span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span></td>
  }
  if (req.isOff) {
    return (
      <td style={{ ...cellStyle, background: 'var(--vacation-soft)' }} onClick={onClick} title="לחצו לעריכת הבקשה">
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--vacation)' }}>חופש</span>
      </td>
    )
  }
  if (req.preferredShiftIds.length === 0) {
    return <td style={cellStyle} onClick={onClick} title="לחצו לעריכת הבקשה"><span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span></td>
  }
  return (
    <td style={{ ...cellStyle, background: 'rgba(19,169,142,0.04)' }} onClick={onClick} title="לחצו לעריכת הבקשה">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        {req.preferredShiftIds.map((sid) => (
          <ShiftChip key={sid} shiftTypeId={sid} shiftTypeIdByKey={shiftTypeIdByKey} />
        ))}
      </div>
    </td>
  )
}

function buildVacationsByEmployee(vacations: ViewVacation[]): Map<string, ViewVacation[]> {
  const m = new Map<string, ViewVacation[]>()
  for (const v of vacations) {
    let list = m.get(v.employeeId)
    if (!list) { list = []; m.set(v.employeeId, list) }
    list.push(v)
  }
  return m
}

/** ISO date for current-week day index 0..6 (Sunday..Saturday). */
function isoForDayIndex(weekStart: string, dayIndex: number): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + dayIndex)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function RequestsOverview({ view }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<RequestEditTarget | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, startClear] = useTransition()

  function clearAll() {
    startClear(async () => {
      await managerClearAllRequests(view.periodId)
      setConfirmClear(false)
      router.refresh()
    })
  }

  // Base-shift options the manager can pick for a worker's request.
  const shiftOptions: ShiftOption[] = BASE_KEYS.filter((k) => view.shiftTypeIdByKey[k]).map((k) => {
    const m = SHIFT_META[k as ShiftId]
    return { id: view.shiftTypeIdByKey[k], name: m?.name ?? k, color: m?.color ?? 'var(--accent)', soft: m?.soft ?? 'var(--accent-soft)' }
  })

  const reqMap = buildRequestMap(view.requests)
  const submitted = submittedCount(view.employees, reqMap)
  const total = view.employees.length
  const vacsByEmp = buildVacationsByEmployee(view.vacations ?? [])
  // Off-day visibility: how many off-requests across the team this week, and
  // how many distinct employees filed at least one. Helps the manager spot a
  // week where mass-off requests will strain coverage.
  const offTotals = (() => {
    let total = 0
    const empsWithOff = new Set<string>()
    for (const r of view.requests) {
      if (r.isOff) { total += 1; empsWithOff.add(r.employeeId) }
    }
    return { total, employees: empsWithOff.size }
  })()
  // Pre-compute ISO date per day index so vacation lookups don't re-parse the
  // week start on every cell.
  const isoByDayIndex = view.days.map((d) => isoForDayIndex(view.weekStart, d.index))

  const stickyName: React.CSSProperties = {
    position: 'sticky',
    right: 0,
    insetInlineEnd: 0,
    background: 'var(--surface-2)',
    borderLeft: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
    padding: '10px 14px',
    fontWeight: 700,
    fontSize: 13,
    zIndex: 2,
    whiteSpace: 'nowrap',
  }

  return (
    <div data-testid="requests-overview">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          direction: 'rtl',
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)' }}>
          הגישו {submitted}/{total} עובדים
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>· לחצו על משבצת כדי להוסיף/לערוך בקשה</span>
        {offTotals.total > 0 && (
          <span
            data-testid="off-requests-summary"
            title="כמות בקשות 'יום חופש / לא זמין' השבוע"
            style={{
              fontSize: 12.5, fontWeight: 700, color: 'var(--vacation)',
              background: 'var(--vacation-soft)', padding: '4px 10px', borderRadius: 99,
            }}
          >
            {offTotals.total} ימי חופש · {offTotals.employees} עובדים
          </span>
        )}
        {view.requests.length > 0 && (
          <span style={{ marginInlineStart: 'auto', display: 'inline-flex', gap: 6 }}>
            {confirmClear ? (
              <>
                <button onClick={clearAll} disabled={clearing} style={clearBtn(true)}>
                  {clearing ? 'מנקה…' : 'בטוח? נקה הכל'}
                </button>
                <button onClick={() => setConfirmClear(false)} disabled={clearing} style={clearBtn(false)}>ביטול</button>
              </>
            ) : (
              <button onClick={() => setConfirmClear(true)} style={clearBtn(false)}>נקה הכל</button>
            )}
          </span>
        )}
      </div>

      <div
        style={{
          overflowX: 'auto',
          direction: 'rtl',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
        }}
      >
        <table style={{ borderCollapse: 'collapse', minWidth: 700, width: '100%', tableLayout: 'auto' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th style={{ ...stickyName, fontSize: 13, padding: '12px 14px' }}>עובד</th>
              {view.days.map((d) => (
                <th
                  key={d.index}
                  style={{
                    padding: '10px 8px',
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: 'center',
                    borderLeft: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    minWidth: 80,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{d.short}</div>
                  <div style={{ fontWeight: 500, color: 'var(--text-2)', fontSize: 11, marginTop: 2 }}>{d.date}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.employees.map((emp, ei) => {
              const byDay = reqMap.get(emp.id)
              const empVacs = vacsByEmp.get(emp.id) ?? []
              const empHasAnyVac = empVacs.length > 0
              return (
                <tr key={emp.id} style={{ background: ei % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                  <td style={{ ...stickyName, background: ei % 2 === 0 ? 'var(--surface-2)' : 'var(--surface-2)' }}>
                    <span style={{ color: emp.color, fontWeight: 700 }}>{emp.name}</span>
                    {empHasAnyVac && (
                      <span
                        title="לעובד יש חופשה בשבוע זה או חופשה פעילה"
                        style={{ marginInlineStart: 6, fontSize: 11, fontWeight: 800, color: 'var(--vacation)', background: 'var(--vacation-soft)', padding: '1px 6px', borderRadius: 99 }}
                      >
                        🌴
                      </span>
                    )}
                  </td>
                  {view.days.map((d) => {
                    const req = byDay?.get(d.index)
                    const onVacation = isInVacationRange(isoByDayIndex[d.index], empVacs.map((v) => ({ date_from: v.dateFrom, date_to: v.dateTo })))
                    return (
                      <DayCell
                        key={d.index}
                        req={req}
                        shiftTypeIdByKey={view.shiftTypeIdByKey}
                        onVacation={onVacation}
                        onClick={onVacation ? undefined : () => setEditing({
                          employeeId: emp.id,
                          employeeName: emp.name,
                          dayOfWeek: d.index,
                          dayLabel: `${d.short} ${d.date}`,
                          isOff: req?.isOff ?? false,
                          preferredShiftIds: req?.preferredShiftIds ?? [],
                        })}
                      />
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <ManagerRequestEditor
          periodId={view.periodId}
          target={editing}
          shiftOptions={shiftOptions}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
