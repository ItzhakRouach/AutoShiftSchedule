import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/user'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { upcomingWeekStartISO } from '@/lib/dates/week'
import { ensureUpcomingPeriodId } from '@/lib/schedule/cached-reads'
import { getScheduleView } from '@/lib/schedule/view-data'
import { getPublishedScheduleView, listPublishedWeeks } from '@/lib/schedule/published-view'
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
  const todayISO = new Date().toISOString().slice(0, 10)
  // Resolve the period id ONCE (cached per-request; getScheduleView reuses it)
  // so getEditMeta can run inside the same Promise.all instead of serially
  // after the view — its ~9 reads are also served from the cached readers.
  const weekStart = upcomingWeekStartISO(new Date())
  const periodId = await ensureUpcomingPeriodId(supabase, workplace.id, weekStart)
  const [view, weeks, workerVacations, editMetaRaw] = await Promise.all([
    getScheduleView(supabase, workplace.id),
    listPublishedWeeks(supabase, workplace.id),
    // Upcoming vacations of ANY status/kind for the "בקשות עובדים" per-worker
    // vacation sheet — richer than view.vacations (approved-only, used for grid
    // shading). Regular authed client: vacations_manager_write (owns_employee)
    // now permits managers to SELECT directly — no service-role needed here,
    // unlike the dashboard's pre-existing admin-client call to this same helper.
    getWorkplaceVacations(supabase, workplace.id, todayISO),
    periodId ? getEditMeta(supabase, workplace.id, periodId, weekStart) : Promise.resolve(null),
  ])
  const currentPeriodId = view?.periodId

  // History view: a PUBLISHED week other than the one currently being edited →
  // read-only.
  const viewingPast = !!sp?.w && weeks.some((w) => w.id === sp.w) && sp.w !== currentPeriodId
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
          <WeekNav weeks={weeks} selectedId={sp.w!} />
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

  // Current period — the live editor (meta already fetched in the parallel block).
  const editMeta = view ? editMetaRaw : null

  return (
    <main className="schedule-main" style={{ background: 'var(--bg)', direction: 'rtl' }}>
      {view ? (
        <ScheduleClient view={view} editMeta={editMeta} workerVacations={workerVacations} />
      ) : (
        <p style={{ textAlign: 'right', color: 'var(--text-2)' }}>
          לא ניתן לטעון את נתוני הסידור כרגע.
        </p>
      )}
    </main>
  )
}
