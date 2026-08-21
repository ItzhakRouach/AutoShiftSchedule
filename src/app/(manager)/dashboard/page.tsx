import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/user'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { getWorkplaceVacations } from '@/lib/vacations/pending'
import { getRoleHeadcounts } from '@/lib/stats/role-headcounts'
import { fetchDashboardStats } from '@/lib/stats/fetch'
import { toISODateUTC } from '@/lib/dates/week'
import { PendingVacations } from './PendingVacations'
import { RoleHeadcounts } from './RoleHeadcounts'
import { Card } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Icon } from '@/components/ui/Icon'
import { ScopeToggle } from './ScopeToggle'
import { PeriodPicker } from './PeriodPicker'
import { buildPeriodOptions } from '@/lib/stats/period-options'
import { DashNav } from './DashNav'
import { CoverageCard } from './CoverageCard'
import { DashPanels } from './DashPanels'
import { TrendsCard } from './TrendsCard'
import { OnboardingSteps } from './OnboardingSteps'
import type { Scope } from '@/lib/stats/types'

// Always reflect the current PUBLISHED state — unpublish/delete must immediately
// drop from the KPIs, hours-per-employee, and fairness panels.
export const dynamic = 'force-dynamic'

function isScope(v: unknown): v is Scope { return v === 'week' || v === 'month' || v === 'year' }

/** True only for a well-formed YYYY-MM-DD that is a real calendar date — keeps
 *  values like 2026-13-45 from ever reaching Postgres as a date literal. */
function isRealISODate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; at?: string }>
}) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  const sp = await searchParams
  const scope: Scope = isScope(sp?.scope) ? sp.scope as Scope : 'week'
  const at = sp?.at && isRealISODate(sp.at) ? sp.at : null

  const todayISO = toISODateUTC(new Date())
  // The data sources are independent — fetch them in parallel. All reads
  // are RLS-covered for the owning manager, so the authed client suffices (no
  // service-role bypass in a user-facing path).
  const [stats, pendingVacations, roleHeadcounts, publishedWeeksRaw] = await Promise.all([
    workplace ? fetchDashboardStats(supabase, workplace.id, scope, at ?? undefined) : null,
    workplace ? getWorkplaceVacations(supabase, workplace.id, todayISO) : [],
    workplace ? getRoleHeadcounts(supabase, workplace.id) : [],
    workplace
      ? supabase
          .from('schedule_periods')
          .select('week_start_date')
          .eq('workplace_id', workplace.id)
          .eq('status', 'published')
          .order('week_start_date', { ascending: false })
          .then(({ data }) => (data ?? []).map((p) => p.week_start_date as string))
      : Promise.resolve([]),
  ])
  const periodOptions = buildPeriodOptions(scope, publishedWeeksRaw)
  const maxHours = Math.max(...(stats?.employees.map((e) => e.hours) ?? [1]), 1)
  const kpis = stats?.kpis

  // ≥2-requests-honored display
  const twoCount = kpis?.twoRequestsHonoredCount ?? 0
  const twoTotal = kpis?.twoRequestsHonoredTotal ?? 0
  const twoValue = twoTotal > 0 ? `${twoCount} / ${twoTotal}` : '—'
  const twoColor =
    twoTotal === 0 ? 'var(--text-3)'
    : twoCount / twoTotal >= 0.75 ? 'var(--success)'
    : 'var(--warning)'

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

      {/* Scope toggle + period picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <Suspense><ScopeToggle scope={scope} /></Suspense>
        </div>
        <Suspense><PeriodPicker options={periodOptions} at={at} /></Suspense>
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
                color={kpis?.uncoveredSlots ? 'var(--danger-2)' : 'var(--success)'} />
            </Card>
            <Card pad={14}>
              <Stat icon="clock" value={kpis?.shifts12h ?? 0} label="משמרות 12 שעות"
                sub="עומס אפשרי"
                color={kpis && kpis.shifts12h > 0 ? 'var(--warning)' : 'var(--text-3)'} />
            </Card>
            <Card pad={14}>
              <Stat icon="users" value={kpis?.belowMinCount ?? 0} label="מתחת למינימום"
                sub="עובדים שקיבלו פחות ממינימום המשמרות שהוגדר להם"
                color={kpis?.belowMinCount ? 'var(--danger-2)' : 'var(--success)'} />
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

          <TrendsCard trends={stats.trends} />

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
