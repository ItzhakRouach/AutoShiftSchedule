'use client'

import { SHIFT_META } from '@/lib/domain/constants'
import { isInVacationRange } from '@/lib/dates/week'
import type { ViewEmployee, ViewRequest, ViewVacation } from '@/lib/schedule/view-data'

interface DayColumn {
  index: number
  short: string
  date: string
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
  const hasPref = req.preferredShiftIds.length > 0
  // Empty request (neither shifts nor off) → dash.
  if (!hasPref && !req.isOff) {
    return <td style={cellStyle} onClick={onClick} title="לחצו לעריכת הבקשה"><span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span></td>
  }
  // Show EVERY chosen option together — preferred shift chips AND a "חופש" chip
  // for a mixed "shift OR off" request (not just one of them).
  return (
    <td
      style={{ ...cellStyle, background: hasPref ? 'rgba(19,169,142,0.04)' : 'var(--vacation-soft)' }}
      onClick={onClick}
      title="לחצו לעריכת הבקשה"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        {req.preferredShiftIds.map((sid) => (
          <ShiftChip key={sid} shiftTypeId={sid} shiftTypeIdByKey={shiftTypeIdByKey} />
        ))}
        {req.isOff && (
          <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 'var(--r-pill)', background: 'var(--vacation-soft)', color: 'var(--vacation)', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
            חופש
          </span>
        )}
      </div>
    </td>
  )
}

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

interface Props {
  emp: ViewEmployee
  rowIndex: number
  days: DayColumn[]
  byDay: Map<number, ViewRequest> | undefined
  empVacs: ViewVacation[]
  isoByDayIndex: string[]
  shiftTypeIdByKey: Record<string, string>
  onEdit: (day: DayColumn, req: ViewRequest | undefined) => void
}

/** One employee's request row: sticky name cell + a DayCell per day. Split out
 *  of RequestsOverview to keep that component ≤200 lines. */
export function RequestsOverviewRow({ emp, rowIndex, days, byDay, empVacs, isoByDayIndex, shiftTypeIdByKey, onEdit }: Props) {
  const empHasAnyVac = empVacs.length > 0
  return (
    <tr style={{ background: rowIndex % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
      <td style={{ ...stickyName, background: 'var(--surface-2)' }}>
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
      {days.map((d) => {
        const req = byDay?.get(d.index)
        const onVacation = isInVacationRange(isoByDayIndex[d.index], empVacs.map((v) => ({ date_from: v.dateFrom, date_to: v.dateTo })))
        return (
          <DayCell
            key={d.index}
            req={req}
            shiftTypeIdByKey={shiftTypeIdByKey}
            onVacation={onVacation}
            onClick={onVacation ? undefined : () => onEdit(d, req)}
          />
        )
      })}
    </tr>
  )
}

export { stickyName }
