'use client'

import { SHIFT_META, ROLE_META, ROLES, type ShiftId } from '@/lib/domain/constants'
import { buildWeekGrid, buildEmpTotals } from '@/lib/schedule/week-table-data'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { SlotCtx } from './SwapEditor'
import type { ShiftKey } from '@/lib/scheduling/types'

interface Props {
  view: ScheduleView
  onSlot?: (slot: SlotCtx) => void
}

const BASE_SHIFTS: ShiftKey[] = ['morning', 'noon', 'night']

/** Cell: shows employees (with -12 suffix) or an unfilled placeholder. */
function Cell({
  entries, empById, isFilled, onClick,
}: {
  entries: { employeeId: string; is12h: boolean }[]
  empById: Map<string, { name: string; color: string }>
  isFilled: boolean
  onClick?: () => void
}) {
  const style: React.CSSProperties = {
    minWidth: 72, padding: '5px 7px', verticalAlign: 'middle',
    borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
    fontSize: 12, cursor: onClick ? 'pointer' : 'default',
    background: entries.length === 0 && !isFilled ? 'rgba(235,106,78,0.06)' : 'var(--surface)',
    textAlign: 'center',
  }
  if (entries.length === 0) {
    return (
      <td style={style} onClick={onClick}>
        <span style={{ color: '#EB6A4E', fontWeight: 600, fontSize: 11 }}>לא מאויש</span>
      </td>
    )
  }
  return (
    <td style={style} onClick={onClick}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {entries.map((en, i) => {
          const emp = empById.get(en.employeeId)
          const label = emp?.name ?? '?'
          return (
            <span key={i} style={{ color: emp?.color ?? 'var(--text)', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {label}{en.is12h ? <span style={{ color: 'var(--accent)', fontWeight: 800 }}>-12</span> : ''}
            </span>
          )
        })}
      </div>
    </td>
  )
}

export function WeekTable({ view, onSlot }: Props) {
  const weekGrid = buildWeekGrid(view)
  const empTotals = buildEmpTotals(view, view.employees)
  const empById = new Map(view.employees.map((e) => [e.id, e]))
  const roleById = new Map(view.roles.map((r) => [r.id, r]))

  // Build ordered role ids from ROLES constant (matching DB names)
  const orderedRoleIds = ROLES.map((rn) => view.roles.find((r) => r.name === rn)?.id).filter(Boolean) as string[]

  // Days in RTL order (index 0 = ראשון rightmost → reverse for visual column order, but CSS handles RTL)
  // We render columns left-to-right in DOM; direction:rtl makes rightmost = first in DOM.
  const days = view.days // [0..6] index 0 = ראשון (rightmost in RTL)

  const stickyCell: React.CSSProperties = {
    position: 'sticky', background: 'var(--surface-2)', fontWeight: 700,
    borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
    zIndex: 2,
  }

  function handleCellClick(day: number, shift: ShiftKey, roleId: string) {
    if (!onSlot) return
    const shiftTypeId = view.shiftTypeIdByKey[shift]
    if (!shiftTypeId) return
    const role = roleById.get(roleId)
    const entries = weekGrid[day]?.[shift]?.[roleId] ?? []
    onSlot({
      day, shiftKey: shift as ShiftId, shiftTypeId, roleId,
      roleName: role?.name ?? '', assignedIds: entries.map((e) => e.employeeId),
    })
  }

  return (
    <div data-testid="week-table" style={{ overflowX: 'auto', direction: 'rtl', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 600, tableLayout: 'auto', width: '100%' }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            <th style={{ ...stickyCell, right: 0, insetInlineEnd: 0, padding: '9px 10px', fontSize: 12 }}>משמרת</th>
            <th style={{ ...stickyCell, right: 62, insetInlineEnd: 62, padding: '9px 8px', fontSize: 12 }}>תפקיד</th>
            {days.map((d) => (
              <th key={d.index} style={{ ...stickyCell, position: undefined, padding: '7px 5px', fontSize: 11, textAlign: 'center', minWidth: 72 }}>
                <div style={{ fontWeight: 800 }}>{d.short}</div>
                <div style={{ fontWeight: 500, color: 'var(--text-2)', fontSize: 10 }}>{d.date}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BASE_SHIFTS.map((shift) => {
            const m = SHIFT_META[shift]
            const reqForShift = orderedRoleIds.filter((rid) => {
              // show rows that have a requirement on at least one day, or any entry
              return days.some((d) => (view.requirements[d.index]?.[shift]?.[rid] ?? 0) > 0)
            })
            const roles = reqForShift.length > 0 ? reqForShift : orderedRoleIds
            return roles.map((roleId, ri) => {
              const role = roleById.get(roleId)
              const roleMeta = role ? ROLE_META[role.name as keyof typeof ROLE_META] : null
              return (
                <tr key={`${shift}-${roleId}`} style={{ background: ri % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                  {ri === 0 && (
                    <td
                      rowSpan={roles.length}
                      style={{
                        ...stickyCell, right: 0, insetInlineEnd: 0, padding: '8px 10px',
                        textAlign: 'center', fontSize: 12, color: m.color, background: m.soft,
                        verticalAlign: 'middle',
                      }}
                    >
                      <div style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-2)', fontWeight: 600 }}>{m.time}</div>
                    </td>
                  )}
                  <td style={{
                    ...stickyCell, right: 62, insetInlineEnd: 62, padding: '7px 8px',
                    fontSize: 11.5, color: roleMeta?.color ?? 'var(--text)', whiteSpace: 'nowrap',
                    background: roleMeta ? roleMeta.soft : 'var(--surface-2)',
                  }}>
                    {role?.name ?? roleId}
                  </td>
                  {days.map((d) => {
                    const entries = weekGrid[d.index]?.[shift]?.[roleId] ?? []
                    const req = view.requirements[d.index]?.[shift]?.[roleId] ?? 0
                    return (
                      <Cell
                        key={d.index}
                        entries={entries}
                        empById={empById}
                        isFilled={entries.length >= req && req > 0}
                        onClick={onSlot ? () => handleCellClick(d.index, shift, roleId) : undefined}
                      />
                    )
                  })}
                </tr>
              )
            })
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-2)' }}>
            <td colSpan={2} style={{ padding: '8px 10px', fontSize: 12, fontWeight: 800, color: 'var(--text-2)' }}>
              סה״כ משמרות לעובד
            </td>
            {days.map((d) => (
              <td key={d.index} style={{ padding: '5px 4px', borderLeft: '1px solid var(--border)', textAlign: 'center', fontSize: 11 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {view.employees.filter((e) => (empTotals[e.id] ?? 0) > 0).slice(0, 4).map((e) => (
                    <span key={e.id} style={{ color: e.color, fontWeight: 700, fontSize: 10 }}>
                      {e.name.split(' ')[0]}: {empTotals[e.id]}
                    </span>
                  ))}
                </div>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
