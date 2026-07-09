import { Card } from '@/components/ui/Card'
import { SectionTitle } from '@/components/ui/SectionTitle'
import type { WeeklyTrend } from '@/lib/stats/trends'

const BAR_H = 56

function fmt(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)}.${Number(m)}`
}

function BarRow({ title, points, color }: { title: string; points: { label: string; pct: number | null }[]; color: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{title}</div>
      {/* Chronological left→right regardless of the page's RTL direction. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, direction: 'ltr', height: BAR_H + 22 }}>
        {points.map((p, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-2)' }}>{p.pct != null ? `${p.pct}%` : '—'}</span>
            <div
              title={`${p.label}: ${p.pct != null ? `${p.pct}%` : 'אין נתון'}`}
              style={{
                width: '100%', maxWidth: 34, borderRadius: '5px 5px 2px 2px',
                height: Math.max(3, ((p.pct ?? 0) / 100) * BAR_H),
                background: p.pct != null ? color : 'var(--surface-sunk)',
                transition: 'height .4s ease',
              }}
            />
            <span style={{ fontSize: 9.5, color: 'var(--text-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Week-over-week trends (month/year scopes): coverage % and request-honored %
 *  per published week. Pure CSS bars — no chart deps, theme-token colors. */
export function TrendsCard({ trends }: { trends: WeeklyTrend[] }) {
  if (trends.length < 2) return null
  const last = trends.slice(-12) // cap the bars so a year scope stays readable
  return (
    <>
      <SectionTitle>מגמות לאורך זמן</SectionTitle>
      <Card style={{ marginBottom: 16 }}>
        <BarRow
          title="כיסוי משמרות לפי שבוע"
          points={last.map((t) => ({ label: fmt(t.weekStart), pct: t.coveragePct }))}
          color="var(--accent)"
        />
        <BarRow
          title="בקשות שכובדו לפי שבוע"
          points={last.map((t) => ({ label: fmt(t.weekStart), pct: t.honoredPct }))}
          color="var(--success)"
        />
      </Card>
    </>
  )
}
