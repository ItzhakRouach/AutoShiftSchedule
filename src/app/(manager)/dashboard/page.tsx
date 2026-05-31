import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { fetchDashboardStats } from '@/lib/stats/fetch'
import { Card } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Icon } from '@/components/ui/Icon'
import { ScopeToggle } from './ScopeToggle'
import { DashNav } from './DashNav'
import { CoverageCard } from './CoverageCard'
import { DashPanels } from './DashPanels'
import type { Scope } from '@/lib/stats/types'

const SCOPE_LABEL: Record<Scope, string> = { week: 'שבוע', month: 'חודש', year: 'שנה' }
function isScope(v: unknown): v is Scope { return v === 'week' || v === 'month' || v === 'year' }

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
  const scope: Scope = isScope(sp?.scope) ? sp.scope as Scope : 'week'
  const scopeLabel = SCOPE_LABEL[scope]

  const stats = workplace ? await fetchDashboardStats(supabase, workplace.id, scope) : null
  const maxHours = Math.max(...(stats?.employees.map((e) => e.hours) ?? [1]), 1)
  const kpis = stats?.kpis

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
        <Suspense><ScopeToggle scope={scope} /></Suspense>
      </div>

      {!stats || stats.kpis.activeEmployees === 0 ? (
        <Card style={{ textAlign: 'center', padding: 32, color: 'var(--text-2)' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>אין נתונים להצגה עדיין</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>הוסיפו עובדים וצרו סידור ראשון</div>
        </Card>
      ) : (
        <>
          {/* Prominent coverage indicator */}
          {kpis && <CoverageCard kpis={kpis} />}

          {/* KPI grid — 2×2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <Card pad={14}>
              <Stat icon="alert" value={kpis?.uncoveredSlots ?? 0} label="משבצות לא מאוישות"
                sub={kpis?.uncoveredSlots ? 'דורש טיפול' : 'הכל מכוסה'}
                color={kpis?.uncoveredSlots ? '#EB6A4E' : '#13A98E'} />
            </Card>
            <Card pad={14}>
              <Stat icon="clock" value={kpis?.shifts12h ?? 0} label="משמרות 12 שעות"
                sub="עומס אפשרי"
                color={kpis && kpis.shifts12h > 0 ? '#E0902A' : 'var(--text-3)'} />
            </Card>
            <Card pad={14}>
              <Stat icon="users" value={kpis?.belowMinCount ?? 0} label="מתחת למינימום"
                sub="עובדים"
                color={kpis?.belowMinCount ? '#EB6A4E' : '#13A98E'} />
            </Card>
            <Card pad={14}>
              <Stat icon="checkCircle"
                value={kpis?.requestHonoredPct != null ? `${kpis.requestHonoredPct}%` : '—'}
                label="בקשות שכובדו"
                sub={kpis?.requestHonoredPct != null ? 'מבקשות העובדים' : 'אין בקשות'}
                color={
                  kpis?.requestHonoredPct != null && kpis.requestHonoredPct >= 80 ? '#13A98E'
                  : kpis?.requestHonoredPct != null ? '#E0902A'
                  : 'var(--text-3)'
                } />
            </Card>
          </div>

          {/* Secondary stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <Card pad={12} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="users" size={17} stroke={2} color="var(--accent)" />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{kpis?.activeEmployees}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2, fontWeight: 500 }}>עובדים פעילים</div>
              </div>
            </Card>
            <Card pad={12} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="clock" size={17} stroke={2} color="var(--accent)" />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{kpis?.totalHours.toLocaleString('he-IL')}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2, fontWeight: 500 }}>{`סה״כ שעות ה${scopeLabel}`}</div>
              </div>
            </Card>
          </div>

          <DashPanels
            employees={stats.employees}
            roles={stats.roles}
            fairness={stats.fairness}
            scopeLabel={scopeLabel}
            maxHours={maxHours}
          />
        </>
      )}

      <DashNav />
    </main>
  )
}
