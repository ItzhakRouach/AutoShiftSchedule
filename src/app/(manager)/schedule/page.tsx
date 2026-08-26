import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/user'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { addDaysISO, todayInIsraelISO, toISODateUTC } from '@/lib/dates/week'
import { resolveEditWeek } from '@/lib/schedule/edit-week'
import { getScheduleView } from '@/lib/schedule/view-data'
import { getPublishedScheduleView, listPublishedWeeks, pastPublishedWeeks } from '@/lib/schedule/published-view'
import { getEditMeta } from '@/lib/schedule/edit-meta'
import { getWorkplaceVacations } from '@/lib/vacations/pending'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { ScheduleClient } from './ScheduleClient'
import { ScheduleGrids } from './ScheduleGrids'
import { WeekNav } from './WeekNav'

// Always reflect the live published state (history view + current editor).
export const dynamic = 'force-dynamic'

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>
}) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) redirect('/onboarding')

  const sp = await searchParams
  const todayISO = toISODateUTC(new Date())
  // The editing week rolls past PUBLISHED weeks (see resolveEditWeek) — once a
  // week is published the editor moves on to building the next one. Cached
  // per-request; getScheduleView resolves the same week for its data.
  const edit = await resolveEditWeek(supabase, workplace.id)

  // ?w= targets another week. While that week hasn't ENDED it opens the LIVE
  // editor — so unpublish + manual/12h edits on a published current week stay
  // possible after the auto-roll. An ended week renders read-only below.
  let liveOverride: { id: string; weekStart: string } | null = null
  if (sp?.w && sp.w !== edit?.periodId) {
    const { data: wRow } = await supabase
      .from('schedule_periods')
      .select('id, week_start_date')
      .eq('id', sp.w)
      .eq('workplace_id', workplace.id)
      .maybeSingle()
    if (wRow && addDaysISO(wRow.week_start_date as string, 6) >= todayInIsraelISO()) {
      liveOverride = { id: wRow.id as string, weekStart: wRow.week_start_date as string }
    }
  }
  const targetPeriodId = liveOverride?.id ?? edit?.periodId ?? null
  const targetWeekStart = liveOverride?.weekStart ?? edit?.weekStart ?? null

  const [view, weeks, workerVacations, editMetaRaw, rolelessRaw] = await Promise.all([
    getScheduleView(supabase, workplace.id, liveOverride?.id),
    listPublishedWeeks(supabase, workplace.id),
    // Upcoming vacations of ANY status/kind for the "בקשות עובדים" per-worker
    // vacation sheet — richer than view.vacations (approved-only, used for grid
    // shading). Regular authed client: vacations_manager_write (owns_employee)
    // now permits managers to SELECT directly — no service-role needed here,
    // unlike the dashboard's pre-existing admin-client call to this same helper.
    getWorkplaceVacations(supabase, workplace.id, todayISO),
    targetPeriodId && targetWeekStart
      ? getEditMeta(supabase, workplace.id, targetPeriodId, targetWeekStart)
      : Promise.resolve(null),
    // Active (joined) employees with their roles — used to warn the manager about
    // role-less workers, who are silently skipped by the auto-scheduler.
    supabase
      .from('employees')
      .select('id, name, employee_roles(role_id)')
      .eq('workplace_id', workplace.id)
      .eq('status', 'active')
      .order('name'),
  ])

  // Role-less active employees match no shift requirement, so the engine and
  // cell-click never offer them (only manual drag works) — surface them.
  const rolelessEmployees = (rolelessRaw.data ?? [])
    .filter((e) => (e.employee_roles ?? []).length === 0)
    .map((e) => ({ id: e.id as string, name: e.name as string }))
  // History navigation covers only weeks strictly BEFORE the editing week —
  // a week published ahead of it must not appear (it would dead-end שבוע קודם
  // on the editor); the editing week itself always opens the live editor.
  const pastWeeks = edit ? pastPublishedWeeks(weeks, edit.weekStart) : []

  // History view: a published week that already ENDED → read-only.
  const viewingPast = !liveOverride && !!sp?.w && pastWeeks.some((w) => w.id === sp.w)
  if (viewingPast) {
    const pubView = await getPublishedScheduleView(supabase, workplace.id, sp.w)
    return (
      <main className="schedule-main" style={{ background: 'var(--bg)', direction: 'rtl' }}>
        <div className="schedule-controls">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
            <h1 style={{ margin: 0, fontSize: 'var(--text-h1)', fontWeight: 800 }}>סידור עבודה</h1>
            <Link href="/schedule" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="arrowLeft" size={15} /> לסידור הנוכחי
            </Link>
          </div>
          <WeekNav weeks={pastWeeks} selectedId={sp.w!} />
        </div>
        {pubView ? (
          <ScheduleGrids view={pubView} />
        ) : (
          <div className="schedule-controls">
            <Card style={{ textAlign: 'center', padding: 32, color: 'var(--text-2)' }}>אין סידור לשבוע זה.</Card>
          </div>
        )}
      </main>
    )
  }

  // Live editor — the rolling edit week, or a not-yet-ended ?w= week.
  const editMeta = view ? editMetaRaw : null

  return (
    <main className="schedule-main" style={{ background: 'var(--bg)', direction: 'rtl' }}>
      {view && (liveOverride || pastWeeks.length > 0) && (
        <div className="schedule-controls" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          {liveOverride ? (
            <Link
              href="/schedule"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
            >
              <Icon name="arrowLeft" size={15} /> לסידור הנוכחי
            </Link>
          ) : (
            <Link
              href={`/schedule?w=${pastWeeks[0].id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
            >
              <Icon name="calendar" size={15} /> סידורים קודמים
            </Link>
          )}
        </div>
      )}
      {view ? (
        // Keyed by period: client-side nav between the rolling editor and a
        // ?w= week must REMOUNT the editor — otherwise per-week client state
        // (selected tab, published flag, undo/drag history) leaks across weeks
        // and e.g. hides the unpublish button on the published week's view.
        <ScheduleClient key={view.periodId} view={view} editMeta={editMeta} workerVacations={workerVacations} rolelessEmployees={rolelessEmployees} />
      ) : (
        <p style={{ textAlign: 'right', color: 'var(--text-2)' }}>
          לא ניתן לטעון את נתוני הסידור כרגע.
        </p>
      )}
    </main>
  )
}
