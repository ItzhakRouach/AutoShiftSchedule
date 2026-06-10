import { Card } from '@/components/ui/Card'
import { shiftTypeOrder, type EmployeeSummary } from '@/lib/stats/employee-summary'
import type { MeSummaryRole } from '@/lib/stats/me-summary-data'

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', borderRadius: 'var(--r-pill)',
  fontSize: 13, fontWeight: 700,
}

function Count({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <span style={{ ...chip, background: color ? `${color}1A` : 'var(--surface-2)', color: color ?? 'var(--text)', border: `1px solid ${color ? `${color}55` : 'var(--border)'}` }}>
      {label}
      <span style={{ background: color ?? 'var(--text-3)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{value}</span>
    </span>
  )
}

const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '0 0 10px' }

export function MeSummary({ summary, roles }: { summary: EmployeeSummary; roles: MeSummaryRole[] }) {
  const shiftLabels = shiftTypeOrder(summary.byShiftType).filter(
    (l) => (summary.byShiftType[l] ?? 0) > 0 || ['בוקר', 'צהריים', 'לילה'].includes(l),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>הסיכום השבועי שלך</span>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            סה״כ <strong style={{ color: 'var(--accent)', fontSize: 16 }}>{summary.total}</strong> משמרות
          </span>
        </div>

        <p style={sectionTitle}>לפי תפקיד</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {roles.map((r) => (
            <Count key={r.name} label={r.name} value={summary.byRole[r.name] ?? 0} color={r.color} />
          ))}
        </div>

        <p style={sectionTitle}>לפי משמרת</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {shiftLabels.map((l) => (
            <Count key={l} label={l} value={summary.byShiftType[l] ?? 0} />
          ))}
        </div>
      </Card>

      <Card style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>בקשות שכובדו</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: summary.honoredCount === summary.requestedCount && summary.requestedCount > 0 ? 'var(--success)' : 'var(--text-2)' }}>
          {summary.requestedCount > 0 ? `כובדו ${summary.honoredCount} מתוך ${summary.requestedCount}` : 'לא הוגשו בקשות'}
        </span>
      </Card>
    </div>
  )
}
