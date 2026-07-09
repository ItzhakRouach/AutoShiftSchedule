'use client'

import { useMemo, useState } from 'react'
import { type ShiftId } from '@/lib/domain/constants'
import { buildWeekGrid, buildEmpTotals } from '@/lib/schedule/week-table-data'
import { buildEmpHours, buildDayHealth } from '@/lib/schedule/week-table-metrics'
import { coveredByTwelve } from '@/lib/schedule/week-table-twelve'
import { buildConflictFlags } from '@/lib/schedule/conflict-flags'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { EditMeta } from '@/lib/schedule/edit-meta'
import type { SlotCtx } from './SwapEditor'
import type { CellAssign } from './useCellAssign'
import type { ShiftKey } from '@/lib/scheduling/types'
import { EmpTotalsBar } from './EmpTotalsBar'
import { WeekTableBody } from './WeekTableBody'
import { busyDaysOf } from './week-table-helpers'
import { SHIFT_W, ROLE_W, S, healthTint } from './week-table-style'
import type { SrcSlot } from './dnd'

interface Props {
  view: ScheduleView
  onSlot?: (slot: SlotCtx) => void
  onDayPair?: (day: number) => void
  /** Fast drag / tap-to-assign interactions (edit mode only). */
  assign?: CellAssign
  /** Pre-select an employee so their cells are highlighted on first render. */
  initialSelectedId?: string
  /** When false, empty cells render blank instead of "לא מאויש" (read-only views). */
  showUnfilled?: boolean
  /** Manager edit metadata — enables inline rest/over-max conflict flags + the
   *  per-day coverage heatmap. Absent on the read-only employee view. */
  editMeta?: EditMeta | null
}

export function WeekTable({ view, onSlot, onDayPair, assign, initialSelectedId, showUnfilled = true, editMeta = null }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null)

  // Heavy derived data — recompute only when inputs actually change.
  const weekGrid = useMemo(() => buildWeekGrid(view), [view])
  const coveredMap = useMemo(() => coveredByTwelve(view), [view])
  const empTotals = useMemo(() => buildEmpTotals(view, view.employees), [view])
  const empHours = useMemo(() => buildEmpHours(view), [view])
  const dayHealth = useMemo(() => buildDayHealth(view), [view])
  const conflictFlags = useMemo(() => buildConflictFlags(view, editMeta), [view, editMeta])
  const empById = useMemo(() => new Map(view.employees.map((e) => [e.id, e])), [view.employees])
  const roleById = useMemo(() => new Map(view.roles.map((r) => [r.id, r])), [view.roles])
  const heldId = assign?.heldId ?? null
  const heldBusyDays = useMemo(() => (heldId ? busyDaysOf(view, heldId) : null), [view, heldId])

  const orderedRoleIds = view.roles.map((r) => r.id)
  const days = view.days
  const toggleSelect = (id: string) => setSelectedId((cur) => (cur === id ? null : id))
  const editable = !!onSlot
  function buildSlot(day: number, shift: ShiftKey, roleId: string): SlotCtx | null {
    const shiftTypeId = view.shiftTypeIdByKey[shift]
    if (!shiftTypeId) return null
    const role = roleById.get(roleId)
    return { day, shiftKey: shift as ShiftId, shiftTypeId, roleId, roleName: role?.name ?? '', assignedIds: (weekGrid[day]?.[shift]?.[roleId] ?? []).map((e) => e.employeeId) }
  }
  function handleCellClick(day: number, shift: ShiftKey, roleId: string) {
    if (!onSlot) return
    if (assign?.heldId && heldBusyDays?.has(day)) return
    const slot = buildSlot(day, shift, roleId)
    if (!slot) return
    if (assign?.assignTo(slot)) return
    onSlot(slot)
  }
  function handleDrop(day: number, shift: ShiftKey, roleId: string, employeeId: string, src?: SrcSlot) {
    // Cell-origin drag → swap with the single occupant, or move to an empty
    // cell (vacating the source). Multi-occupant / 12h / temp targets fall
    // through to the legacy assign path.
    if (src && assign) {
      const sameCell = src.day === day && src.shift === shift && src.roleId === roleId
      const targetEntries = weekGrid[day]?.[shift]?.[roleId] ?? []
      const shiftTypeId = view.shiftTypeIdByKey[shift]
      const srcShiftTypeId = view.shiftTypeIdByKey[src.shift]
      if (!sameCell && shiftTypeId && srcShiftTypeId && !targetEntries.some((e) => e.employeeId === employeeId)) {
        const a = { employeeId, day: src.day, shiftTypeId: srcShiftTypeId, roleId: src.roleId }
        const target = { day, shiftKey: shift as ShiftId, shiftTypeId, roleId }
        const swappable = targetEntries.length === 1 && !targetEntries[0].is12h && targetEntries[0].tempName == null
        if (swappable) {
          assign.swapWith(a, target, { employeeId: targetEntries[0].employeeId, day, shiftTypeId, roleId })
          return
        }
        if (targetEntries.length === 0) {
          assign.swapWith(a, target, null)
          return
        }
      }
      if (sameCell) return
    }
    if (busyDaysOf(view, employeeId).has(day)) return
    const slot = buildSlot(day, shift, roleId)
    if (slot) assign?.dropOn(slot, employeeId)
  }

  return (
    <div>
      {selectedId && <div style={{ direction: 'rtl', marginBottom: 8, fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>מוצג: <strong style={{ color: empById.get(selectedId)?.color }}>{empById.get(selectedId)?.name}</strong></span>
        <button onClick={() => setSelectedId(null)} style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-2)' }}>נקה</button></div>}
      <div data-testid="week-table" style={{ overflowX: 'auto', direction: 'rtl', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', transform: 'translateZ(0)' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 700, tableLayout: 'auto', width: '100%' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th style={{ ...S.sticky, right: 0, zIndex: 3, padding: '10px 8px', fontSize: 13, width: SHIFT_W, minWidth: SHIFT_W, maxWidth: SHIFT_W, borderBottom: '3px solid var(--text)' }}><span style={S.layer}>משמרת</span></th>
              <th style={{ ...S.sticky, right: SHIFT_W, zIndex: 3, padding: '10px 8px', fontSize: 13, width: ROLE_W, minWidth: ROLE_W, maxWidth: ROLE_W, borderBottom: '3px solid var(--text)' }}><span style={S.layer}>תפקיד</span></th>
              {days.map((d) => {
                const dh = dayHealth[d.index]
                // Heatmap tint only when the day has required slots (manager view);
                // read-only/no-requirement days keep the neutral header.
                const tint = dh.required > 0 ? healthTint(dh.ratio) : undefined
                return (
                  <th key={d.index} style={{ ...S.sticky, position: undefined, padding: '10px 8px', fontSize: 12, textAlign: 'center', minWidth: 96, background: tint ?? 'var(--surface-2)', borderBottom: '3px solid var(--text)' }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{d.short}</div>
                    <div style={{ fontWeight: 500, color: 'var(--text-2)', fontSize: 11, marginTop: 2 }}>{d.date}</div>
                    {onDayPair && (
                      <button data-testid="day-pair-btn" aria-label="החל צמד משמרת 12 שעות ליום זה" title="החל צמד משמרת 12 שעות ליום זה" onClick={() => onDayPair(d.index)} style={S.dayPairBtn}>12ש׳</button>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <WeekTableBody
            view={view}
            orderedRoleIds={orderedRoleIds}
            roleById={roleById}
            empById={empById}
            weekGrid={weekGrid}
            coveredMap={coveredMap}
            conflictFlags={conflictFlags}
            selectedId={selectedId}
            editable={editable}
            showUnfilled={showUnfilled}
            assign={assign}
            heldBusyDays={heldBusyDays}
            onCellClick={handleCellClick}
            onDrop={handleDrop}
            onRemoveEmployee={assign ? (day, id) => assign.removeFrom(id, day) : undefined}
          />
        </table>
      </div>
      <EmpTotalsBar employees={view.employees} empTotals={empTotals} empHours={empHours} selectedId={selectedId} onToggle={toggleSelect} editMeta={editMeta} />
    </div>
  )
}
