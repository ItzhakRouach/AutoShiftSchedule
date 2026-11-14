import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { LtrText } from '@/components/ui/LtrText'
import { addDaysISO, formatHebDate } from '@/lib/dates/week'
import type { WeekInWork } from '@/lib/stats/week-in-work'

const MAX_NAMES = 6

const chip = (color: string, bg: string): React.CSSProperties => ({
  fontSize: 'var(--text-sm)', fontWeight: 700, color, background: bg, padding: '5px 10px', borderRadius: 'var(--r-sm)',
})
const label: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-2)', margin: 0 }

/**
 * The manager's "where does this week stand?" card: how much of the week being
 * built is staffed, how request collection is going, and one button to carry on.
 */
export function WeekInWorkCard({ week }: { week: WeekInWork }) {
  const filled = week.totalCells - week.openCells
  const pct = week.totalCells > 0 ? Math.round((filled / week.totalCells) * 100) : 0
  const names = week.notSubmitted.slice(0, MAX_NAMES)
  const more = week.notSubmitted.length - names.length

  return (
    <div data-testid="week-in-work" style={{ marginBottom: 16 }}>
      <Card pad={18}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 'var(--text-h2)', fontWeight: 800, color: 'var(--text)' }}>
              השבוע בעבודה · <LtrText>{formatHebDate(week.weekStart)}–{formatHebDate(addDaysISO(week.weekStart, 6))}</LtrText>
            </h2>
            <span style={week.hasAssignments ? chip('var(--text)', 'var(--warning-soft)') : chip('var(--text-2)', 'var(--surface-sunk)')}>
              {week.hasAssignments ? 'טיוטה · לא פורסם' : 'טרם שובץ'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={label}>שיבוץ</p>
            <div className="tabular" style={{ fontSize: 'var(--text-h3)', fontWeight: 700, color: 'var(--text)' }}>
              {week.totalCells > 0 ? `${filled} מתוך ${week.totalCells} משבצות מאוישות` : 'לא הוגדרו דרישות איוש'}
            </div>
            <div style={{ display: 'flex', height: 10, borderRadius: 99, background: 'var(--accent-soft)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, background: 'var(--accent)', borderRadius: 99 }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {week.totalCells > 0 && (
                <span data-testid="week-open-cells" style={week.openCells > 0 ? chip('var(--danger)', 'var(--danger-soft)') : chip('var(--success)', 'var(--success-soft)')}>
                  {week.openCells > 0 ? `${week.openCells} משבצות פתוחות` : 'כל המשבצות מאוישות'}
                </span>
              )}
              {week.twelveCount > 0 && <span style={chip('var(--text)', 'var(--warning-soft)')}>משמרות של 12 שעות: {week.twelveCount}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <p style={label}>בקשות העובדים</p>
              {week.deadline && (
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: week.deadline.passed ? 'var(--text-2)' : 'var(--warning)' }}>
                  {week.deadline.passed ? 'מועד ההגשה עבר' : `נסגר ב${week.deadline.label}`}
                </span>
              )}
            </div>
            <div data-testid="week-submitted" style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span className="tabular" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: week.submittedCount === week.rosterCount ? 'var(--success)' : 'var(--text)' }}>{week.submittedCount}</span>
              <span style={{ fontSize: 'var(--text-body)', color: 'var(--text-2)' }}>מתוך {week.rosterCount} עובדים הגישו</span>
            </div>
            {names.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
                <span>טרם הגישו:</span>
                {names.map((n) => (
                  <span key={n} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: 'var(--r-pill)', color: 'var(--text)' }}>{n}</span>
                ))}
                {more > 0 && <span>ועוד {more}</span>}
              </div>
            )}
          </div>

          <Link
            href="/schedule"
            className="btn"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 'var(--r-md)', background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 'var(--text-h3)', fontWeight: 700, textDecoration: 'none' }}
          >
            {week.hasAssignments ? 'המשך עריכה ופרסום' : 'מעבר לשיבוץ'}
          </Link>
        </div>
      </Card>
    </div>
  )
}
