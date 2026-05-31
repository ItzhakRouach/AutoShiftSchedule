'use client'

import { SHIFT_META } from '@/lib/domain/constants'
import type { ScheduleView, ViewEmployee, ViewRequest } from '@/lib/schedule/view-data'

interface Props {
  view: ScheduleView
}

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

function DayCell({ req, shiftTypeIdByKey }: { req: ViewRequest | undefined; shiftTypeIdByKey: Record<string, string> }) {
  const cellStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderLeft: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
    textAlign: 'center',
    verticalAlign: 'middle',
    minWidth: 80,
  }
  if (!req) {
    return <td style={cellStyle}><span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span></td>
  }
  if (req.isOff) {
    return (
      <td style={{ ...cellStyle, background: 'rgba(91,97,214,0.06)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#5B61D6' }}>חופש</span>
      </td>
    )
  }
  if (req.preferredShiftIds.length === 0) {
    return <td style={cellStyle}><span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span></td>
  }
  return (
    <td style={{ ...cellStyle, background: 'rgba(19,169,142,0.04)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        {req.preferredShiftIds.map((sid) => (
          <ShiftChip key={sid} shiftTypeId={sid} shiftTypeIdByKey={shiftTypeIdByKey} />
        ))}
      </div>
    </td>
  )
}

export function RequestsOverview({ view }: Props) {
  const reqMap = buildRequestMap(view.requests)
  const submitted = submittedCount(view.employees, reqMap)
  const total = view.employees.length

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
              return (
                <tr key={emp.id} style={{ background: ei % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                  <td style={{ ...stickyName, background: ei % 2 === 0 ? 'var(--surface-2)' : 'var(--surface-2)' }}>
                    <span style={{ color: emp.color, fontWeight: 700 }}>{emp.name}</span>
                  </td>
                  {view.days.map((d) => (
                    <DayCell
                      key={d.index}
                      req={byDay?.get(d.index)}
                      shiftTypeIdByKey={view.shiftTypeIdByKey}
                    />
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
