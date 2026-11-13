import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { LtrText } from '@/components/ui/LtrText'
import type { MyShift, MyWeek } from '@/lib/schedule/my-shifts'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

/** "2026-11-15" → "15.11" */
function dm(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d}.${m}`
}

const dayTitle = (i: number) => (i === 6 ? 'שבת' : `יום ${DAY_NAMES[i]}`)

/** The hero card: the one thing an employee opens the app to find out. */
export function NextShiftCard({ shift, when }: { shift: MyShift; when: string }) {
  return (
    <Link href="/me/schedule" data-testid="next-shift" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
      <div style={{ background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 'var(--r-lg)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: 'var(--shadow)' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, opacity: 0.9 }}>המשמרת הבאה שלך</span>
        <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px' }}>{dayTitle(shift.dayIndex)} · {shift.name}</span>
        <span className="tabular" style={{ fontSize: 'var(--text-h2)', fontWeight: 600 }}>
          {dm(shift.dateISO)} · <LtrText>{shift.time}</LtrText>{shift.roleName ? ` · ${shift.roleName}` : ''}
        </span>
        <span style={{ alignSelf: 'flex-start', marginTop: 4, fontSize: 'var(--text-sm)', fontWeight: 700, background: 'var(--surface)', color: 'var(--accent)', padding: '5px 12px', borderRadius: 'var(--r-pill)' }}>
          {when}
        </span>
      </div>
    </Link>
  )
}

/** One published week as seven rows — the employee's shifts only. */
export function MyWeekList({ week, title }: { week: MyWeek; title: string }) {
  return (
    <div data-testid="my-week" style={{ marginBottom: 12 }}>
    <Card style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-h2)', fontWeight: 700, color: 'var(--text)' }}>
          {title} · <LtrText>{dm(week.days[0].dateISO)}–{dm(week.days[6].dateISO)}</LtrText>
        </h2>
        <span className="tabular" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
          {week.shiftCount} משמרות · {week.hours} שעות
        </span>
      </div>
      {week.days.map((d) => (
        <div key={d.dateISO} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 38, borderTop: d.dayIndex === 0 ? 'none' : '1px solid var(--border)' }}>
          <span className="tabular" style={{ width: 64, flexShrink: 0, fontSize: 'var(--text-body)', fontWeight: 700, color: d.shift ? 'var(--text)' : 'var(--text-3)' }}>
            {DAY_SHORT[d.dayIndex]} {dm(d.dateISO)}
          </span>
          {d.shift ? (
            <>
              <span className="tabular" style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--text)', background: `${d.shift.color}33`, borderInlineStart: `4px solid ${d.shift.color}`, padding: '4px 10px', borderRadius: 8 }}>
                {d.shift.name} <LtrText>{d.shift.time}</LtrText>
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>{d.shift.roleName}</span>
            </>
          ) : (
            <span style={{ fontSize: 'var(--text-body)', color: 'var(--text-3)' }}>ללא משמרת</span>
          )}
        </div>
      ))}
    </Card>
    </div>
  )
}
