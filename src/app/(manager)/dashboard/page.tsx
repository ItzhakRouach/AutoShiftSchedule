import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { getWorkplaceVacations } from '@/lib/vacations/pending'
import { getRoleHeadcounts } from '@/lib/stats/role-headcounts'
import { fetchDashboardStats } from '@/lib/stats/fetch'
import { PendingVacations } from './PendingVacations'
import { RoleHeadcounts } from './RoleHeadcounts'
import { Card } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Icon } from '@/components/ui/Icon'
import { ScopeToggle } from './ScopeToggle'
import { DashNav } from './DashNav'
import { CoverageCard } from './CoverageCard'
import { DashPanels } from './DashPanels'
import { OnboardingSteps } from './OnboardingSteps'
import type { Scope } from '@/lib/stats/types'

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

  const stats = workplace ? await fetchDashboardStats(supabase, workplace.id, scope) : null
  const todayISO = new Date().toISOString().slice(0, 10)
  const admin = createAdminClient()
  const pendingVacations = workplace ? await getWorkplaceVacations(admin, workplace.id, todayISO) : []
  const roleHeadcounts = workplace ? await getRoleHeadcounts(admin, workplace.id) : []
  const maxHours = Math.max(...(stats?.employees.map((e) => e.hours) ?? [1]), 1)
  const kpis = stats?.kpis

  // ≥2-requests-honored display
  const twoCount = kpis?.twoRequestsHonoredCount ?? 0
  const twoTotal = kpis?.twoRequestsHonoredTotal ?? 0
  const twoValue = twoTotal > 0 ? `${twoCount} / ${twoTotal}` : '—'
  const twoColor =
    twoTotal === 0 ? 'var(--text-3)'
    : twoCount / twoTotal >= 0.75 ? '#13A98E'
    : '#E0902A'

  return (
    <main className="page-wrap wide" style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 'var(--text-h1)', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {workplace?.name ?? 'דשבורד'}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>שלום, {user.email}</p>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
          <Icon name="chart" size={20} stroke={2} />
        </div>
      </div>

      {/* Pending vacation requests — popup on entry + card */}
      <PendingVacations items={pendingVacations} />

      {/* Scope toggle */}
      <div style={{ marginBottom: 18 }}>
        <Suspense><ScopeToggle scope={scope} /></Suspense>
      </div>

      {!stats || stats.kpis.activeEmployees === 0 ? (
        <OnboardingSteps />
      ) : (
        <>
          {/* Team composition by role (hybrid — any roles, each its own color) */}
          <RoleHeadcounts roles={roleHeadcounts} />

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
                sub="עובדים שקיבלו פחות ממינימום המשמרות שהוגדר להם"
                color={kpis?.belowMinCount ? '#EB6A4E' : '#13A98E'} />
            </Card>
            <Card pad={14}>
              <Stat icon="checkCircle"
                value={twoValue}
                label="כיבוד בקשות עובדים"
                sub={twoTotal > 0 ? 'עובדים שקיבלו לפחות שתיים מהמשמרות שביקשו' : 'אין בקשות'}
                color={twoColor} />
            </Card>
          </div>

          {/* Secondary stats row — active employees */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 16 }}>
            <Card pad={12} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="users" size={17} stroke={2} color="var(--accent)" />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{kpis?.activeEmployees}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2, fontWeight: 500 }}>עובדים פעילים</div>
              </div>
            </Card>
          </div>

          <DashPanels
            employees={stats.employees}
            fairness={stats.fairness}
            maxHours={maxHours}
          />
        </>
      )}

      <DashNav />
    </main>
  )
}
