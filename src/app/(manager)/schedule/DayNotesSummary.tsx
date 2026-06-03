import type { ScheduleView } from '@/lib/schedule/view-data'

/** Read-only at-a-glance panel of the period's day notes (רענון / free text). */
export function DayNotesSummary({ view }: { view: ScheduleView }) {
  const notes = view.dayNotes ?? []
  if (notes.length === 0) return null

  return (
    <div className="schedule-controls" style={{ marginTop: 12 }}>
      <div data-testid="day-notes-summary" style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', marginBottom: 8 }}>רענון / הערות יום</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {notes.map((n) => {
            const emp = view.employees.find((e) => e.id === n.employeeId)
            return (
              <span key={`${n.employeeId}:${n.day}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700 }}>
                {emp?.name?.split(' ')[0] ?? '?'} · {n.label} · {view.days[n.day]?.short ?? n.day}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
