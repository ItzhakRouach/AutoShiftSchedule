import { Card } from '@/components/ui/Card'
import { SectionTitle } from '@/components/ui/SectionTitle'
import type { RoleHeadcount } from '@/lib/stats/role-headcounts'

/** Team composition: a colored tile per role with its headcount. Hybrid — it
 *  renders whatever roles the workplace defined, each in its own color. */
export function RoleHeadcounts({ roles }: { roles: RoleHeadcount[] }) {
  if (roles.length === 0) return null
  return (
    <>
      <SectionTitle>צוות לפי תפקיד</SectionTitle>
      <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '-4px 0 10px' }}>
        כמה עובדים יכולים לאייש כל תפקיד — דרגה גבוהה יכולה לכסות גם תפקידים נמוכים יותר.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(roles.length, 3)}, 1fr)`,
          gap: 10,
          marginBottom: 16,
        }}
      >
        {roles.map((r) => (
          <Card
            key={r.id}
            pad={14}
            style={{ borderTop: `3px solid ${r.color}`, display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.name}
              </span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: r.color, lineHeight: 1 }}>{r.count}</div>
          </Card>
        ))}
      </div>
    </>
  )
}
