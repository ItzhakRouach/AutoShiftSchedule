'use client'

import { Btn } from '@/components/ui/Btn'
import { LtrText } from '@/components/ui/LtrText'
import type { ViewEmployee } from '@/lib/schedule/view-data'

const chip = (color: string, bg: string): React.CSSProperties => ({
  fontSize: 'var(--text-sm)', fontWeight: 700, color, background: bg, padding: '4px 10px', borderRadius: 'var(--r-pill)',
})

/**
 * Top of the assign window: what exactly is being filled (role, hours, how many
 * are still missing) and who is in the cell now, each removable.
 */
export function AssignHeader({
  roleName, time, required, assigned, busy, onRemove,
}: {
  roleName: string
  time: string
  /** Required headcount for this role in this shift; 0 when none is configured. */
  required: number
  assigned: ViewEmployee[]
  busy: boolean
  onRemove: (employeeId: string) => void
}) {
  const missing = Math.max(0, required - assigned.length)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <span style={chip('var(--text)', 'var(--surface-sunk)')}>תפקיד: {roleName}</span>
        <span style={chip('var(--text)', 'var(--surface-sunk)')}><LtrText>{time}</LtrText></span>
        {required > 0 && (
          <span data-testid="assign-missing" style={missing > 0 ? chip('var(--danger)', 'var(--danger-soft)') : chip('var(--success)', 'var(--success-soft)')}>
            {missing > 0 ? `חסר ${missing} מתוך ${required}` : `מלא ${assigned.length}/${required}`}
          </span>
        )}
      </div>

      {assigned.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-2)' }}>משובצים עכשיו</div>
          {assigned.map((e) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: e.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 'var(--text-h3)', fontWeight: 700, color: 'var(--text)' }}>{e.name}</span>
              <Btn variant="danger" size="sm" disabled={busy} onClick={() => onRemove(e.id)}>הסר</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
