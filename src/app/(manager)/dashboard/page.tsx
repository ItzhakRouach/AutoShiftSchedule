import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { fetchDashboardStats } from '@/lib/stats/fetch'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Stat } from '@/components/ui/Stat'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { Icon } from '@/components/ui/Icon'
import { ScopeToggle } from './ScopeToggle'
import { DashNav } from './DashNav'
import type { Scope } from '@/lib/stats/types'

const SCOPE_LABEL: Record<Scope, string> = { week: 'שבוע', month: 'חודש', year: 'שנה' }

function isScope(v: unknown): v is Scope {
  return v === 'week' || v === 'month' || v === 'year'
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  const sp = await searchParams
  const rawScope = sp?.scope
  const scope: Scope = isScope(rawScope) ? rawScope : 'week'
  const scopeLabel = SCOPE_LABEL[scope]

  const stats = workplace
    ? await fetchDashboardStats(supabase, workplace.id, scope)
    : null

  const maxHours = Math.max(...(stats?.employees.map((e) => e.hours) ?? [1]), 1)

  return (
    <main style={{ background: 'var(--bg)', padding: '24px 20px', maxWidth: 520, margin: '0 auto', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
            {workplace?.name ?? 'דשבורד'}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>שלום, {user.email}</p>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
          <Icon name="chart" size={20} stroke={2} />
        </div>
      </div>

      {/* Scope toggle */}
      <div style={{ marginBottom: 18 }}>
        <Suspense>
          <ScopeToggle scope={scope} />
        </Suspense>
      </div>

      {!stats || stats.kpis.activeEmployees === 0 ? (
        <Card style={{ textAlign: 'center', padding: 32, color: 'var(--text-2)' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>אין נתונים להצגה עדיין</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>הוסיפו עובדים וצרו סידור ראשון</div>
        </Card>
      ) : (
        <>
          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <Card pad={14}><Stat icon="users" value={stats.kpis.activeEmployees} label="עובדים פעילים" /></Card>
            <Card pad={14}><Stat icon="calendar" value={stats.kpis.totalShifts} label={`משמרות ה${scopeLabel}`} color="#13A98E" /></Card>
            <Card pad={14}><Stat icon="clock" value={stats.kpis.totalHours.toLocaleString('he-IL')} label={`שעות ה${scopeLabel}`} color="#E0902A" /></Card>
            <Card pad={14}>
              <Stat
                icon="shield"
                value={stats.kpis.coveragePct != null ? `${stats.kpis.coveragePct}%` : '—'}
                label="כיסוי השיבוץ"
                color={stats.kpis.coveragePct != null && stats.kpis.coveragePct >= 95 ? '#13A98E' : '#EB6A4E'}
              />
            </Card>
          </div>

          {/* Hours per employee */}
          <SectionTitle>שעות עבודה לפי עובד</SectionTitle>
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 16 }}>
            {stats.employees.map((emp) => (
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
          {stats.roles.length > 0 && (
            <>
              <SectionTitle>{`פילוח לפי תפקיד · ה${scopeLabel}`}</SectionTitle>
              <Card style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {stats.roles.map((role, i) => (
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
          {stats.fairness.length > 0 && (
            <>
              <SectionTitle>הוגנות</SectionTitle>
              <Card pad={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>
                  <span>עובד</span><span style={{ textAlign: 'center' }}>לילה</span><span style={{ textAlign: 'center' }}>סוף שבוע</span><span style={{ textAlign: 'center' }}>בקשות</span>
                </div>
                {stats.fairness.map((f, i) => (
                  <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '10px 14px', borderBottom: i < stats.fairness.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, alignItems: 'center' }}>
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
      )}

      <DashNav />
    </main>
  )
}
