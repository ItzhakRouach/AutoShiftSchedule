'use client'

import type { ViewEmployee } from '@/lib/schedule/view-data'
import type { EmpTotals } from '@/lib/schedule/week-table-data'

interface Props {
  employees: ViewEmployee[]
  empTotals: EmpTotals
  selectedId: string | null
  onToggle: (id: string) => void
}

/** Footer row of per-employee shift-count chips below the week table. */
export function EmpTotalsBar({ employees, empTotals, selectedId, onToggle }: Props) {
  const withShifts = employees.filter((e) => (empTotals[e.id] ?? 0) > 0)
  const zero = employees.filter((e) => (empTotals[e.id] ?? 0) === 0)

  return (
    <div data-testid="emp-totals-summary" style={{ direction: 'rtl', marginTop: 16, padding: '14px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', marginBottom: 10 }}>סה״כ משמרות לעובד</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {withShifts.map((e) => {
          const isSelected = selectedId === e.id
          return (
            <span key={e.id} data-testid="emp-total-chip"
              role="button" aria-pressed={isSelected}
              onClick={() => onToggle(e.id)}
              title={isSelected ? 'לחץ לביטול הסימון' : 'לחץ לסימון עובד'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: `${e.color}22`, border: isSelected ? `2px solid ${e.color}` : `1.5px solid ${e.color}55`, fontSize: 12, fontWeight: 700, color: e.color, whiteSpace: 'nowrap', cursor: 'pointer', opacity: selectedId && !isSelected ? 0.45 : 1, transition: 'opacity 0.15s, border 0.15s' }}>
              {e.name.split(' ')[0]}<span style={{ background: e.color, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>{empTotals[e.id]}</span>
            </span>
          )
        })}
        {zero.map((e) => (
          <span key={e.id} data-testid="emp-total-chip-zero" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'var(--surface)', border: '1.5px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap', opacity: 0.6 }}>
            {e.name.split(' ')[0]}<span style={{ background: 'var(--border)', color: 'var(--text-2)', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>0</span>
          </span>
        ))}
      </div>
    </div>
  )
}
