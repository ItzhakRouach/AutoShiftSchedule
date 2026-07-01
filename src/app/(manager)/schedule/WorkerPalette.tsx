'use client'

import { Avatar } from '@/components/ui/Avatar'
import type { ViewEmployee } from '@/lib/schedule/view-data'

const DND_MIME = 'application/x-employee-id'

interface Props {
  employees: ViewEmployee[]
  heldId: string | null
  /** Toggle "holding" a worker for tap-to-assign. */
  onHold: (id: string) => void
  /** True while a dispatch is in flight — chips dim and stop responding. */
  disabled?: boolean
}

/** A draggable strip of all workers. Drag a chip onto a cell, OR tap a chip to
 *  "hold" it and then tap a target cell — both assign without opening the modal. */
export function WorkerPalette({ employees, heldId, onHold, disabled }: Props) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, direction: 'rtl' }}>
        גררו עובד לתא, או הקישו עובד ואז תא לשיבוץ מהיר
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, direction: 'rtl' }}>
        {employees.map((e) => {
          const held = heldId === e.id
          return (
            <button
              key={e.id}
              draggable={!disabled}
              disabled={disabled}
              onDragStart={(ev) => { ev.dataTransfer.setData(DND_MIME, e.id); ev.dataTransfer.effectAllowed = 'move' }}
              onClick={() => onHold(e.id)}
              aria-pressed={held}
              title={held ? 'מוחזק — הקישו תא לשיבוץ' : 'גררו לתא או הקישו לבחירה'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                padding: '5px 10px', borderRadius: 99, cursor: disabled ? 'not-allowed' : 'grab',
                border: `1.5px solid ${held ? 'var(--accent)' : 'var(--border)'}`,
                background: held ? 'var(--accent-soft)' : 'var(--surface)',
                color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
                opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? 'none' : undefined,
              }}
            >
              <Avatar name={e.name} color={e.color} size={22} />
              {e.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
