'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { shiftTypeOrder } from '@/lib/stats/employee-summary'
import type { MeStatsData, MeSummaryRole, ScopedBreakdown } from '@/lib/stats/me-summary-data'

const SCOPES = [
  { value: 'week', label: 'שבוע' },
  { value: 'month', label: 'חודש' },
  { value: 'year', label: 'שנה' },
]

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', borderRadius: 'var(--r-pill)', fontSize: 13, fontWeight: 700,
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

export function MeStats({ data }: { data: MeStatsData }) {
  const [scope, setScope] = useState<'week' | 'month' | 'year'>('month')
  const b: ScopedBreakdown = data[scope]
  const shiftLabels = shiftTypeOrder(b.byShiftType).filter(
    (l) => (b.byShiftType[l] ?? 0) > 0 || ['בוקר', 'צהריים', 'לילה'].includes(l),
  )

  return (
    <Card style={{ padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>הסטטיסטיקה שלי</span>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          סה״כ <strong style={{ color: 'var(--accent)', fontSize: 16 }}>{b.total}</strong> משמרות
        </span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Segmented options={SCOPES} value={scope} onChange={(v) => setScope(v as 'week' | 'month' | 'year')} />
      </div>

      <p style={sectionTitle}>לפי תפקיד</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {data.roles.map((r: MeSummaryRole) => (
          <Count key={r.name} label={r.name} value={b.byRole[r.name] ?? 0} color={r.color} />
        ))}
      </div>

      <p style={sectionTitle}>לפי משמרת</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {shiftLabels.map((l) => (
          <Count key={l} label={l} value={b.byShiftType[l] ?? 0} />
        ))}
      </div>
    </Card>
  )
}
