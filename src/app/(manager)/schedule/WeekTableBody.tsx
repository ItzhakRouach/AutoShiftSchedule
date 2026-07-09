'use client'

import { shiftMetaFromRow, roleMetaFromRow } from '@/lib/domain/meta'
import { cellCapacity, type WeekGrid } from '@/lib/schedule/week-table-data'
import type { ConflictReason } from '@/lib/schedule/conflict-flags'
import { conflictLabel } from '@/lib/schedule/conflict-flags'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { ShiftKey } from '@/lib/scheduling/types'
import { LtrText } from '@/components/ui/LtrText'
import { WeekTableCell } from './WeekTableCell'
import { buildCellLabel } from './week-table-helpers'
import { BASE_SHIFTS, SHIFT_W, ROLE_W, S } from './week-table-style'
import type { CellAssign } from './useCellAssign'
import type { SrcSlot } from './dnd'

interface Props {
  view: ScheduleView
  orderedRoleIds: string[]
  roleById: Map<string, { name: string; color?: string }>
  empById: Map<string, { name: string; color: string }>
  weekGrid: WeekGrid
  coveredMap: Map<string, number>
  conflictFlags: Map<string, ConflictReason>
  selectedId: string | null
  editable: boolean
  showUnfilled: boolean
  assign?: CellAssign
  heldBusyDays: Set<number> | null
  onCellClick: (day: number, shift: ShiftKey, roleId: string) => void
  onDrop: (day: number, shift: ShiftKey, roleId: string, employeeId: string, src?: SrcSlot) => void
  /** Over-capacity cleanup: unassign a worker straight from the cell ×. */
  onRemoveEmployee?: (day: number, employeeId: string) => void
}

/** The week table's <tbody> — one shift-group of role rows per base shift.
 *  Split out of WeekTable to keep both files ≤200 lines. */
export function WeekTableBody(props: Props) {
  const { view, orderedRoleIds, roleById, empById, weekGrid, coveredMap, conflictFlags } = props
  const { selectedId, editable, showUnfilled, assign, heldBusyDays, onCellClick, onDrop, onRemoveEmployee } = props
  const days = view.days
  return (
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
          const groupDividerStyle: React.CSSProperties = showGroupDivider ? { borderTop: '3px solid var(--text)' } : {}
          const shiftTint = `color-mix(in srgb, ${m.soft} 55%, var(--surface))`
          const rowBg = ri % 2 === 0 ? shiftTint : 'var(--bg)'
          return (
            <tr key={`${shift}-${roleId}`} style={{ background: rowBg, ...groupDividerStyle }}>
              {ri === 0 && (
                <td rowSpan={roles.length} style={{ ...S.sticky, right: 0, padding: '12px 8px', textAlign: 'center', fontSize: 13, color: m.color, background: `color-mix(in srgb, ${m.color} 16%, var(--surface))`, verticalAlign: 'middle', width: SHIFT_W, minWidth: SHIFT_W, maxWidth: SHIFT_W, borderTop: showGroupDivider ? '3px solid var(--text)' : undefined }}>
                  <div style={S.layer}>
                    <div style={{ fontWeight: 800, whiteSpace: 'nowrap', fontSize: 13 }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, marginTop: 3 }}><LtrText>{m.time}</LtrText></div>
                  </div>
                </td>
              )}
              <td style={{ ...S.sticky, right: SHIFT_W, padding: '10px 8px', fontSize: 12.5, color: rm?.color ?? 'var(--text)', whiteSpace: 'nowrap', background: rm ? `color-mix(in srgb, ${rm.color} 16%, var(--surface))` : 'var(--surface-2)', width: ROLE_W, minWidth: ROLE_W, maxWidth: ROLE_W, borderTop: showGroupDivider ? '3px solid var(--text)' : undefined }}>
                <span style={S.layer}>{role?.name ?? roleId}</span>
              </td>
              {days.map((d) => {
                const requiredCount = view.requirements[d.index]?.[shift]?.[roleId] ?? 0
                const cellEntries = weekGrid[d.index]?.[shift]?.[roleId] ?? []
                const coveredCount = coveredMap.get(`${d.index}:${shift}:${roleId}`) ?? 0
                const covered = coveredCount > 0
                const assignedCount = cellEntries.length + coveredCount
                const capacity = cellCapacity(assignedCount, requiredCount)
                const isBusy = !!assign?.pendingSlot && assign.pendingSlot.day === d.index && assign.pendingSlot.shiftKey === shift && assign.pendingSlot.roleId === roleId
                const cellLabel = buildCellLabel(d.index, m.name, role?.name ?? roleId, cellEntries, empById, covered)
                const heldBlocked = !!heldBusyDays?.has(d.index) && !cellEntries.some((e) => e.employeeId === assign?.heldId)
                // Worst conflict among this cell's occupants (rest > overmax).
                let conflict: ConflictReason | undefined
                for (const e of cellEntries) {
                  const r = conflictFlags.get(`${d.index}:${e.employeeId}`)
                  if (r === 'rest') { conflict = 'rest'; break }
                  if (r) conflict = r
                }
                return (
                  <WeekTableCell key={d.index}
                    entries={cellEntries}
                    empById={empById}
                    isFilled={assignedCount >= requiredCount && requiredCount > 0}
                    covered={covered}
                    selectedId={selectedId}
                    onClick={editable ? () => onCellClick(d.index, shift, roleId) : undefined}
                    showUnfilled={showUnfilled}
                    isBusy={isBusy}
                    onDropEmployee={assign ? (id, src) => onDrop(d.index, shift, roleId, id, src) : undefined}
                    onDragEmployee={assign ? assign.clearHeld : undefined}
                    onRemoveTemp={assign ? assign.removeTemp : undefined}
                    onRemoveEmployee={assign && onRemoveEmployee ? (id) => onRemoveEmployee(d.index, id) : undefined}
                    capacityLabel={editable ? capacity.label : ''}
                    capacityStatus={editable ? capacity.status : 'unconfigured'}
                    cellLabel={cellLabel}
                    topDivider={showGroupDivider}
                    heldBlocked={heldBlocked}
                    conflictReason={conflict}
                    conflictTitle={conflict ? conflictLabel(conflict) : undefined}
                    srcSlot={assign ? { day: d.index, shift, roleId } : undefined}
                  />
                )
              })}
            </tr>
          )
        })
      })}
    </tbody>
  )
}
