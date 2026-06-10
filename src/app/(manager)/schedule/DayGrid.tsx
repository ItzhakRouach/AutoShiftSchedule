'use client'

import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { RoleChip } from '@/components/ui/RoleChip'
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { SlotCtx } from './SwapEditor'
import type { ShiftKey } from '@/lib/scheduling/types'

interface Props {
  view: ScheduleView
  selDay: number
  onSlot?: (slot: SlotCtx) => void
  /** When set (employee viewing their own schedule), that employee's chips pop. */
  selfId?: string
}

/** Per-shift cards for the selected day, showing each role's required count
 *  and assigned employees, with red markers for unfilled slots. Slots open the
 *  SwapEditor via onSlot when provided. */
export function DayGrid({ view, selDay, onSlot, selfId }: Props) {
  const empById = new Map(view.employees.map((e) => [e.id, e]))
  const roleById = new Map(view.roles.map((r) => [r.id, r]))
  const open = (shift: ShiftKey, roleId: string, assignedIds: string[]) => {
    if (!onSlot) return
    const shiftTypeId = view.shiftTypeIdByKey[shift]
    if (!shiftTypeId) return
    onSlot({ day: selDay, shiftKey: shift as ShiftId, shiftTypeId, roleId, roleName: roleById.get(roleId)?.name ?? '', assignedIds })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {view.shiftKeys.map((shift: ShiftKey) => {
        const m = SHIFT_META[shift]
        const req = view.requirements[selDay]?.[shift] ?? {}
        const roleIds = Object.keys(req)
        return (
          <Card key={shift} pad={0} style={{ overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '12px 14px',
                background: m.soft,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{m.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>{m.time}</div>
              </div>
            </div>
            <div style={{ padding: '6px 14px 12px' }}>
              {roleIds.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>
                  אין דרישת איוש למשמרת זו
                </div>
              )}
              {roleIds.map((roleId) => {
                const need = req[roleId] ?? 0
                if (!need) return null
                const filled = view.grid[selDay]?.[shift]?.[roleId] ?? []
                const role = roleById.get(roleId)
                const missing = Math.max(0, need - filled.length)
                return (
                  <div key={roleId} style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 7,
                      }}
                    >
                      <RoleChip roleName={role?.name ?? ''} size="sm" />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: filled.length >= need ? '#13A98E' : '#EB6A4E',
                        }}
                      >
                        {filled.length}/{need}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {filled.map((eid) => {
                        const e = empById.get(eid)
                        const isSelf = !!selfId && eid === selfId
                        return (
                          <span
                            key={eid}
                            onClick={() => open(shift, roleId, filled)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 7,
                              padding: '5px 11px 5px 7px',
                              borderRadius: 99,
                              border: `1.5px solid ${isSelf ? 'var(--accent)' : 'var(--border)'}`,
                              background: isSelf ? 'var(--accent-soft)' : 'var(--surface-2)',
                              cursor: onSlot ? 'pointer' : 'default',
                            }}
                          >
                            <Avatar name={e?.name ?? '?'} color={e?.color ?? '#888'} size={24} />
                            <span style={{ fontSize: 13, fontWeight: isSelf ? 800 : 600, color: isSelf ? 'var(--accent)' : 'var(--text)' }}>
                              {e?.name ?? 'לא ידוע'}{isSelf ? ' (אני)' : ''}
                            </span>
                          </span>
                        )
                      })}
                      {Array.from({ length: missing }).map((_, k) => (
                        <span
                          key={'e' + k}
                          onClick={() => open(shift, roleId, filled)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 13px',
                            borderRadius: 99,
                            border: '1.5px dashed #EB6A4E',
                            background: 'rgba(235,106,78,0.07)',
                            color: '#EB6A4E',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: onSlot ? 'pointer' : 'default',
                          }}
                        >
                          <Icon name="plus" size={15} stroke={2.2} /> לא מאויש
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}

      {view.twelve.filter((t) => t.day === selDay).length > 0 && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: 14, fontWeight: 800 }}>משמרות 12 שעות</div>
          <div style={{ padding: '0 14px 12px', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {view.twelve
              .filter((t) => t.day === selDay)
              .map((t, i) => {
                const e = empById.get(t.employeeId)
                return (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '5px 11px 5px 7px', borderRadius: 99,
                      border: '1px solid var(--accent)', background: 'var(--accent-soft)',
                    }}
                    data-testid="twelve-badge"
                  >
                    <Avatar name={e?.name ?? '?'} color={e?.color ?? '#888'} size={24} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{e?.name ?? 'לא ידוע'}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>12ש׳</span>
                  </span>
                )
              })}
          </div>
        </Card>
      )}
    </div>
  )
}
