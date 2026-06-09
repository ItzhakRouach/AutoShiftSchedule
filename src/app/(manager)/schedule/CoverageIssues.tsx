'use client'

import { Card } from '@/components/ui/Card'
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import type { ScheduleView } from '@/lib/schedule/view-data'
import type { OverriddenOff, Warning } from '@/lib/scheduling/types'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function shiftName(shift: string): string {
  return SHIFT_META[shift as ShiftId]?.name ?? shift
}

/**
 * Post-generate alert. Shows (a) slots that couldn't be staffed at all, and
 * (b) workers the engine had to pull in DESPITE an off-request (because the day
 * was otherwise uncoverable) — so the manager can talk to them or rework the
 * requests. `overridden.roleId` and `uncovered.roleId` are already role NAMES.
 */
export function CoverageIssues({
  overridden,
  uncovered,
  view,
}: {
  overridden: OverriddenOff[]
  uncovered: Warning[]
  view: ScheduleView
}) {
  if (overridden.length === 0 && uncovered.length === 0) return null
  const nameOf = (id: string) => view.employees.find((e) => e.id === id)?.name ?? '—'

  return (
    <Card style={{ padding: '14px 16px', marginBottom: 14, border: '1px solid rgba(235,106,78,0.35)', background: 'rgba(235,106,78,0.06)' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#C2410C', marginBottom: 8 }}>
        בעיות כיסוי — דרושה תשומת לבך
      </div>

      {uncovered.length > 0 && (
        <div style={{ marginBottom: overridden.length ? 12 : 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            לא ניתן לאייש ({uncovered.length}):
          </div>
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
            {uncovered.map((w, i) => (
              <li key={i}>
                {DAY_NAMES[w.day]} · {shiftName(w.shift)} · {w.roleId}
                {w.missing > 1 ? ` ×${w.missing}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {overridden.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            שובצו למרות בקשת חופש (כדי לאייש את היום) — כדאי לתאם איתם:
          </div>
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
            {overridden.map((o, i) => (
              <li key={i}>
                <strong style={{ color: 'var(--text)' }}>{nameOf(o.employeeId)}</strong> — {DAY_NAMES[o.day]} · {shiftName(o.shift)} · {o.roleId}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
