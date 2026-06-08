import type { MyRoleCount } from '@/lib/stats/my-role-counts'

const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 'var(--r-pill)',
  fontSize: 13,
  fontWeight: 700,
}

/**
 * Compact "how many shifts you got in each role" strip for the worker's
 * schedule page. Mirrors the role-chip styling used by MeSummary on /me.
 */
export function MyRoleCounts({ roles, total }: { roles: MyRoleCount[]; total: number }) {
  if (roles.length === 0) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', margin: '0 0 8px' }}>
        המשמרות שלך לפי תפקיד · סה״כ {total}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {roles.map((r) => (
          <span
            key={r.roleId}
            style={{
              ...chip,
              background: `${r.color}1A`,
              color: r.color,
              border: `1px solid ${r.color}55`,
            }}
          >
            {r.name}
            <span style={{ background: r.color, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
              {r.count}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
