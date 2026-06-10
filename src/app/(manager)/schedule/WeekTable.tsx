'use client'

import { useMemo, useState } from 'react'
import { type ShiftId } from '@/lib/domain/constants'
import { shiftMetaFromRow, roleMetaFromRow } from '@/lib/domain/meta'
import { buildWeekGrid, buildEmpTotals, coveredByTwelve } from '@/lib/schedule/week-table-data'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { SlotCtx } from './SwapEditor'
import type { ShiftKey } from '@/lib/scheduling/types'
import { EmpTotalsBar } from './EmpTotalsBar'
import { WeekTableCell } from './WeekTableCell'

interface Props {
  view: ScheduleView
  onSlot?: (slot: SlotCtx) => void
  onDayPair?: (day: number) => void
  /** Pre-select an employee so their cells are highlighted on first render. */
  initialSelectedId?: string
  /** When false, empty cells render blank instead of "לא מאויש" (read-only views
   *  without requirements data, e.g. the employee schedule). */
  showUnfilled?: boolean
}

const BASE_SHIFTS: ShiftKey[] = ['morning', 'noon', 'night']

const S = {
  sticky: { position: 'sticky', background: 'var(--surface-2)', fontWeight: 700, borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', zIndex: 2 } as React.CSSProperties,
  dayPairBtn: { marginTop: 4, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, borderRadius: 99, border: '1px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font)' } as React.CSSProperties,
}

export function WeekTable({ view, onSlot, onDayPair, initialSelectedId, showUnfilled = true }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null)

  // Heavy derived data — recompute only when `view` actually changes. Without
  // useMemo, every cell-click (which sets selectedId) would re-walk the grid.
  const weekGrid = useMemo(() => buildWeekGrid(view), [view])
  const coveredSet = useMemo(() => coveredByTwelve(view), [view])
  const empTotals = useMemo(() => buildEmpTotals(view, view.employees), [view])
  const empById = useMemo(() => new Map(view.employees.map((e) => [e.id, e])), [view.employees])
  const roleById = useMemo(() => new Map(view.roles.map((r) => [r.id, r])), [view.roles])

  // Roles already arrive active + rank-desc from the view (senior first).
  const orderedRoleIds = view.roles.map((r) => r.id)
  const days = view.days
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
                    <button data-testid="day-pair-btn" aria-label="החל צמד משמרת 12 שעות ליום זה" title="החל צמד משמרת 12 שעות ליום זה" onClick={() => onDayPair(d.index)} style={S.dayPairBtn}>12ש׳</button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BASE_SHIFTS.map((shift) => {
              const m = view.shiftMeta?.[shift] ?? shiftMetaFromRow({ key: shift })
              const reqForShift = orderedRoleIds.filter((rid) => days.some((d) => (view.requirements[d.index]?.[shift]?.[rid] ?? 0) > 0))
              const roles = reqForShift.length > 0 ? reqForShift : orderedRoleIds
              const isFirstShift = shift === BASE_SHIFTS[0]
              return roles.map((roleId, ri) => {
                const role = roleById.get(roleId)
                const rm = role ? roleMetaFromRow(role) : null
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
                      <WeekTableCell key={d.index}
                        entries={weekGrid[d.index]?.[shift]?.[roleId] ?? []}
                        empById={empById}
                        isFilled={(weekGrid[d.index]?.[shift]?.[roleId] ?? []).length >= (view.requirements[d.index]?.[shift]?.[roleId] ?? 0) && (view.requirements[d.index]?.[shift]?.[roleId] ?? 0) > 0}
                        covered={coveredSet.has(`${d.index}:${shift}:${roleId}`)}
                        selectedId={selectedId}
                        onClick={onSlot ? () => handleCellClick(d.index, shift, roleId) : undefined}
                        onSelectEmp={toggleSelect}
                        showUnfilled={showUnfilled}
                      />
                    ))}
                  </tr>
                )
              })
            })}
          </tbody>
        </table>
      </div>
      <EmpTotalsBar employees={view.employees} empTotals={empTotals} selectedId={selectedId} onToggle={toggleSelect} />
    </div>
  )
}
