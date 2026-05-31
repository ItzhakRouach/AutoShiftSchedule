import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { SectionTitle } from '@/components/ui/SectionTitle'
import type { EmployeeStat, RoleStat, FairnessStat } from '@/lib/stats/types'

interface Props {
  employees: EmployeeStat[]
  roles: RoleStat[]
  fairness: FairnessStat[]
  scopeLabel: string
  maxHours: number
}

export function DashPanels({ employees, roles, fairness, scopeLabel, maxHours }: Props) {
  return (
    <>
      {/* Hours per employee */}
      <SectionTitle>שעות עבודה לפי עובד</SectionTitle>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 16 }}>
        {employees.map((emp) => (
          <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <Avatar name={emp.name} color={emp.color} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', flexShrink: 0 }}>{emp.hours} ש׳ · {emp.shifts} מ׳</span>
              </div>
              <div style={{ height: 7, borderRadius: 99, background: 'var(--surface-sunk)', overflow: 'hidden' }}>
                <div style={{ width: `${(emp.hours / maxHours) * 100}%`, height: '100%', borderRadius: 99, background: emp.color, transition: 'width .5s ease' }} />
              </div>
            </div>
          </div>
        ))}
      </Card>

      {/* Role distribution */}
      {roles.length > 0 && (
        <>
          <SectionTitle>{`פילוח לפי תפקיד · ה${scopeLabel}`}</SectionTitle>
          <Card style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {roles.map((role, i) => (
              <div key={role.id} style={{ display: 'flex', flex: 1, gap: 8 }}>
                {i > 0 && <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: role.color, letterSpacing: '-0.5px' }}>{role.count}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3, fontWeight: 600 }}>{role.name}</div>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Fairness panel */}
      {fairness.length > 0 && (
        <>
          <SectionTitle>הוגנות</SectionTitle>
          <Card pad={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>
              <span>עובד</span>
              <span style={{ textAlign: 'center' }}>לילה</span>
              <span style={{ textAlign: 'center' }}>סוף שבוע</span>
              <span style={{ textAlign: 'center' }}>בקשות</span>
            </div>
            {fairness.map((f, i) => (
              <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '10px 14px', borderBottom: i < fairness.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-2)' }}>{f.nightShifts}</span>
                <span style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-2)' }}>{f.weekendShifts}</span>
                <span style={{ textAlign: 'center', fontWeight: 700, color: f.requestHonoredPct != null && f.requestHonoredPct >= 80 ? '#13A98E' : 'var(--text-2)' }}>
                  {f.requestHonoredPct != null ? `${f.requestHonoredPct}%` : '—'}
                </span>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  )
}
