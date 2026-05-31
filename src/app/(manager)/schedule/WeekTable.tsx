'use client'

import { SHIFT_META, ROLE_META, ROLES, type ShiftId } from '@/lib/domain/constants'
import { buildWeekGrid, buildEmpTotals } from '@/lib/schedule/week-table-data'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { SlotCtx } from './SwapEditor'
import type { ShiftKey } from '@/lib/scheduling/types'

interface Props { view: ScheduleView; onSlot?: (slot: SlotCtx) => void }

const BASE_SHIFTS: ShiftKey[] = ['morning', 'noon', 'night']

const S = {
  sticky: { position: 'sticky', background: 'var(--surface-2)', fontWeight: 700, borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', zIndex: 2 } as React.CSSProperties,
  cellBase: { padding: '10px 12px', verticalAlign: 'middle', borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: 13, textAlign: 'center' } as React.CSSProperties,
}

function Badge() {
  return (
    <span title="ביקש משמרת זו" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: 'rgba(19,169,142,0.18)', color: '#13A98E', fontSize: 9, fontWeight: 800, marginRight: 3, flexShrink: 0, cursor: 'help' }}>
      ✓
    </span>
  )
}

function Cell({ entries, empById, isFilled, onClick }: {
  entries: { employeeId: string; is12h: boolean; requested: boolean }[]
  empById: Map<string, { name: string; color: string }>
  isFilled: boolean
  onClick?: () => void
}) {
  const bg = entries.length === 0 && !isFilled ? 'rgba(235,106,78,0.06)' : 'var(--surface)'
  if (entries.length === 0) {
    return (
      <td style={{ ...S.cellBase, background: bg, cursor: onClick ? 'pointer' : 'default', minWidth: 96 }} onClick={onClick}>
        <span style={{ color: '#EB6A4E', fontWeight: 600, fontSize: 12 }}>לא מאויש</span>
      </td>
    )
  }
  return (
    <td style={{ ...S.cellBase, background: bg, cursor: onClick ? 'pointer' : 'default', minWidth: 96 }} onClick={onClick}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map((en, i) => {
          const emp = empById.get(en.employeeId)
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', color: emp?.color ?? 'var(--text)', fontWeight: 700, whiteSpace: 'nowrap', fontSize: 13, lineHeight: 1.4 }}>
              {en.requested && <Badge />}
              {emp?.name ?? '?'}
              {en.is12h ? <span style={{ color: 'var(--accent)', fontWeight: 800, marginRight: 2 }}>-12</span> : ''}
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
  const orderedRoleIds = ROLES.map((rn) => view.roles.find((r) => r.name === rn)?.id).filter(Boolean) as string[]
  const days = view.days

  function handleCellClick(day: number, shift: ShiftKey, roleId: string) {
    if (!onSlot) return
    const shiftTypeId = view.shiftTypeIdByKey[shift]
    if (!shiftTypeId) return
    const role = roleById.get(roleId)
    onSlot({ day, shiftKey: shift as ShiftId, shiftTypeId, roleId, roleName: role?.name ?? '', assignedIds: (weekGrid[day]?.[shift]?.[roleId] ?? []).map((e) => e.employeeId) })
  }

  return (
    <div data-testid="week-table" style={{ overflowX: 'auto', direction: 'rtl', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 700, tableLayout: 'auto', width: '100%' }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            <th style={{ ...S.sticky, right: 0, insetInlineEnd: 0, padding: '12px 14px', fontSize: 13, minWidth: 80 }}>משמרת</th>
            <th style={{ ...S.sticky, right: 80, insetInlineEnd: 80, padding: '12px 10px', fontSize: 13, minWidth: 72 }}>תפקיד</th>
            {days.map((d) => (
              <th key={d.index} style={{ ...S.sticky, position: undefined, padding: '10px 8px', fontSize: 12, textAlign: 'center', minWidth: 96 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{d.short}</div>
                <div style={{ fontWeight: 500, color: 'var(--text-2)', fontSize: 11, marginTop: 2 }}>{d.date}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BASE_SHIFTS.map((shift) => {
            const m = SHIFT_META[shift]
            const reqForShift = orderedRoleIds.filter((rid) => days.some((d) => (view.requirements[d.index]?.[shift]?.[rid] ?? 0) > 0))
            const roles = reqForShift.length > 0 ? reqForShift : orderedRoleIds
            return roles.map((roleId, ri) => {
              const role = roleById.get(roleId)
              const rm = role ? ROLE_META[role.name as keyof typeof ROLE_META] : null
              return (
                <tr key={`${shift}-${roleId}`} style={{ background: ri % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                  {ri === 0 && (
                    <td rowSpan={roles.length} style={{ ...S.sticky, right: 0, insetInlineEnd: 0, padding: '10px 14px', textAlign: 'center', fontSize: 13, color: m.color, background: m.soft, verticalAlign: 'middle', minWidth: 80 }}>
                      <div style={{ fontWeight: 800, whiteSpace: 'nowrap', fontSize: 13 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, marginTop: 3 }}>{m.time}</div>
                    </td>
                  )}
                  <td style={{ ...S.sticky, right: 80, insetInlineEnd: 80, padding: '10px 12px', fontSize: 12.5, color: rm?.color ?? 'var(--text)', whiteSpace: 'nowrap', background: rm ? rm.soft : 'var(--surface-2)', minWidth: 72 }}>
                    {role?.name ?? roleId}
                  </td>
                  {days.map((d) => (
                    <Cell key={d.index} entries={weekGrid[d.index]?.[shift]?.[roleId] ?? []} empById={empById}
                      isFilled={(weekGrid[d.index]?.[shift]?.[roleId] ?? []).length >= (view.requirements[d.index]?.[shift]?.[roleId] ?? 0) && (view.requirements[d.index]?.[shift]?.[roleId] ?? 0) > 0}
                      onClick={onSlot ? () => handleCellClick(d.index, shift, roleId) : undefined} />
                  ))}
                </tr>
              )
            })
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-2)' }}>
            <td colSpan={2} style={{ padding: '10px 14px', fontSize: 13, fontWeight: 800, color: 'var(--text-2)' }}>סה״כ משמרות לעובד</td>
            {days.map((d) => (
              <td key={d.index} style={{ padding: '8px 8px', borderLeft: '1px solid var(--border)', textAlign: 'center', fontSize: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {view.employees.filter((e) => (empTotals[e.id] ?? 0) > 0).slice(0, 4).map((e) => (
                    <span key={e.id} style={{ color: e.color, fontWeight: 700, fontSize: 11 }}>{e.name.split(' ')[0]}: {empTotals[e.id]}</span>
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
