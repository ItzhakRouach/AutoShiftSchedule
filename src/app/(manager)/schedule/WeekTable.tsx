'use client'

import { useState } from 'react'
import { SHIFT_META, ROLE_META, ROLES, type ShiftId } from '@/lib/domain/constants'
import { buildWeekGrid, buildEmpTotals } from '@/lib/schedule/week-table-data'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { SlotCtx } from './SwapEditor'
import type { ShiftKey } from '@/lib/scheduling/types'

interface Props { view: ScheduleView; onSlot?: (slot: SlotCtx) => void; onDayPair?: (day: number) => void }

const BASE_SHIFTS: ShiftKey[] = ['morning', 'noon', 'night']

const S = {
  sticky: { position: 'sticky', background: 'var(--surface-2)', fontWeight: 700, borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', zIndex: 2 } as React.CSSProperties,
  cellBase: { padding: '10px 12px', verticalAlign: 'middle', borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: 13, textAlign: 'center' } as React.CSSProperties,
  dayPairBtn: { marginTop: 4, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, borderRadius: 99, border: '1px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font)' } as React.CSSProperties,
}

function Badge() {
  return (
    <span title="ביקש משמרת זו" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: 'rgba(19,169,142,0.18)', color: '#13A98E', fontSize: 9, fontWeight: 800, marginRight: 3, flexShrink: 0, cursor: 'help' }}>
      ✓
    </span>
  )
}

function Cell({ entries, empById, isFilled, selectedId, onClick, onSelectEmp }: {
  entries: { employeeId: string; is12h: boolean; requested: boolean }[]
  empById: Map<string, { name: string; color: string }>
  isFilled: boolean
  selectedId: string | null
  onClick?: () => void
  onSelectEmp: (id: string) => void
}) {
  const hasSelected = selectedId !== null
  const cellHasSelected = hasSelected && entries.some((e) => e.employeeId === selectedId)
  const bg = entries.length === 0 && !isFilled ? 'rgba(235,106,78,0.06)' : 'var(--surface)'
  const dimCell = hasSelected && !cellHasSelected
  const highlightCell = cellHasSelected

  const cellStyle: React.CSSProperties = {
    ...S.cellBase,
    background: bg,
    cursor: onClick ? 'pointer' : 'default',
    minWidth: 96,
    opacity: dimCell ? 0.4 : 1,
    outline: highlightCell ? '2px solid var(--accent, #13A98E)' : undefined,
    outlineOffset: highlightCell ? '-2px' : undefined,
    transition: 'opacity 0.15s, outline 0.15s',
  }

  if (entries.length === 0) {
    return (
      <td style={cellStyle} onClick={onClick}>
        <span style={{ color: '#EB6A4E', fontWeight: 600, fontSize: 12 }}>לא מאויש</span>
      </td>
    )
  }
  return (
    <td style={cellStyle} onClick={onClick}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map((en, i) => {
          const emp = empById.get(en.employeeId)
          const isSelected = selectedId === en.employeeId
          return (
            <span
              key={i}
              role="button"
              aria-pressed={isSelected}
              title={isSelected ? 'לחץ לביטול הסימון' : 'לחץ לסימון עובד'}
              onClick={(ev) => { ev.stopPropagation(); onSelectEmp(en.employeeId) }}
              style={{
                display: 'inline-flex', alignItems: 'center',
                color: emp?.color ?? 'var(--text)', fontWeight: 700,
                whiteSpace: 'nowrap', fontSize: 13, lineHeight: 1.4,
                cursor: 'pointer',
                opacity: hasSelected && !isSelected ? 0.35 : 1,
                textDecoration: isSelected ? 'underline' : undefined,
                transition: 'opacity 0.15s',
              }}
            >
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

export function WeekTable({ view, onSlot, onDayPair }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const weekGrid = buildWeekGrid(view)
  const empTotals = buildEmpTotals(view, view.employees)
  const empById = new Map(view.employees.map((e) => [e.id, e]))
  const roleById = new Map(view.roles.map((r) => [r.id, r]))
  const orderedRoleIds = ROLES.map((rn) => view.roles.find((r) => r.name === rn)?.id).filter(Boolean) as string[]
  const days = view.days
  const empsWithShifts = view.employees.filter((e) => (empTotals[e.id] ?? 0) > 0)
  const empsZero = view.employees.filter((e) => (empTotals[e.id] ?? 0) === 0)
  const toggleSelect = (id: string) => setSelectedId((cur) => (cur === id ? null : id))
  function handleCellClick(day: number, shift: ShiftKey, roleId: string) {
    if (!onSlot) return
    const shiftTypeId = view.shiftTypeIdByKey[shift]
    if (!shiftTypeId) return
    const role = roleById.get(roleId)
    onSlot({ day, shiftKey: shift as ShiftId, shiftTypeId, roleId, roleName: role?.name ?? '', assignedIds: (weekGrid[day]?.[shift]?.[roleId] ?? []).map((e) => e.employeeId) })
  }

  return (
    <div>
      {selectedId && <div style={{ direction: 'rtl', marginBottom: 8, fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>מוצג: <strong style={{ color: empById.get(selectedId)?.color }}>{empById.get(selectedId)?.name}</strong></span>
        <button onClick={() => setSelectedId(null)} style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-2)' }}>נקה</button></div>}
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
                  {onDayPair && (
                    <button data-testid="day-pair-btn" title="החל צמד משמרת 12 שעות ליום זה" onClick={() => onDayPair(d.index)} style={S.dayPairBtn}>12ש׳</button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BASE_SHIFTS.map((shift) => {
              const m = SHIFT_META[shift]
              const reqForShift = orderedRoleIds.filter((rid) => days.some((d) => (view.requirements[d.index]?.[shift]?.[rid] ?? 0) > 0))
              const roles = reqForShift.length > 0 ? reqForShift : orderedRoleIds
              const isFirstShift = shift === BASE_SHIFTS[0]
              return roles.map((roleId, ri) => {
                const role = roleById.get(roleId)
                const rm = role ? ROLE_META[role.name as keyof typeof ROLE_META] : null
                const showGroupDivider = ri === 0 && !isFirstShift
                const groupDividerStyle: React.CSSProperties = showGroupDivider ? { borderTop: '3px solid var(--border-strong, var(--border))' } : {}
                const shiftTint = `color-mix(in srgb, ${m.soft} 55%, var(--surface))`
                const rowBg = ri % 2 === 0 ? shiftTint : 'var(--bg)'
                return (
                  <tr key={`${shift}-${roleId}`} style={{ background: rowBg, ...groupDividerStyle }}>
                    {ri === 0 && (
                      <td rowSpan={roles.length} style={{ ...S.sticky, right: 0, insetInlineEnd: 0, padding: '12px 14px', textAlign: 'center', fontSize: 13, color: m.color, background: m.soft, verticalAlign: 'middle', minWidth: 80, borderTop: showGroupDivider ? '3px solid var(--border-strong, var(--border))' : undefined }}>
                        <div style={{ fontWeight: 800, whiteSpace: 'nowrap', fontSize: 13 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, marginTop: 3 }}>{m.time}</div>
                      </td>
                    )}
                    <td style={{ ...S.sticky, right: 80, insetInlineEnd: 80, padding: '10px 12px', fontSize: 12.5, color: rm?.color ?? 'var(--text)', whiteSpace: 'nowrap', background: rm ? rm.soft : 'var(--surface-2)', minWidth: 72 }}>
                      {role?.name ?? roleId}
                    </td>
                    {days.map((d) => (
                      <Cell key={d.index}
                        entries={weekGrid[d.index]?.[shift]?.[roleId] ?? []}
                        empById={empById}
                        isFilled={(weekGrid[d.index]?.[shift]?.[roleId] ?? []).length >= (view.requirements[d.index]?.[shift]?.[roleId] ?? 0) && (view.requirements[d.index]?.[shift]?.[roleId] ?? 0) > 0}
                        selectedId={selectedId}
                        onClick={onSlot ? () => handleCellClick(d.index, shift, roleId) : undefined}
                        onSelectEmp={toggleSelect}
                      />
                    ))}
                  </tr>
                )
              })
            })}
          </tbody>
        </table>
      </div>
      <div data-testid="emp-totals-summary" style={{ direction: 'rtl', marginTop: 16, padding: '14px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', marginBottom: 10 }}>סה״כ משמרות לעובד</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {empsWithShifts.map((e) => {
            const isSelected = selectedId === e.id
            return (
              <span key={e.id} data-testid="emp-total-chip"
                role="button" aria-pressed={isSelected}
                onClick={() => toggleSelect(e.id)}
                title={isSelected ? 'לחץ לביטול הסימון' : 'לחץ לסימון עובד'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: `${e.color}22`, border: isSelected ? `2px solid ${e.color}` : `1.5px solid ${e.color}55`, fontSize: 12, fontWeight: 700, color: e.color, whiteSpace: 'nowrap', cursor: 'pointer', opacity: selectedId && !isSelected ? 0.45 : 1, transition: 'opacity 0.15s, border 0.15s' }}>
                {e.name.split(' ')[0]}<span style={{ background: e.color, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>{empTotals[e.id]}</span>
              </span>
            )
          })}
          {empsZero.map((e) => (
            <span key={e.id} data-testid="emp-total-chip-zero" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'var(--surface)', border: '1.5px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap', opacity: 0.6 }}>
              {e.name.split(' ')[0]}<span style={{ background: 'var(--border)', color: 'var(--text-2)', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>0</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
