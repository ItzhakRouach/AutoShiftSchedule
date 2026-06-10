import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { getScheduleView } from '@/lib/schedule/view-data'
import { getPublishedScheduleView, listPublishedWeeks } from '@/lib/schedule/published-view'
import { getEditMeta } from '@/lib/schedule/edit-meta'
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) redirect('/onboarding')

  const sp = await searchParams
  const [view, weeks] = await Promise.all([
    getScheduleView(supabase, workplace.id),
    listPublishedWeeks(supabase, workplace.id),
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

  // Current period — the live editor.
  const editMeta = view ? await getEditMeta(supabase, workplace.id, view.periodId) : null
  const pastWeeks = weeks.filter((w) => w.id !== currentPeriodId)

  return (
    <main className="schedule-main" style={{ background: 'var(--bg)', direction: 'rtl' }}>
      {view ? (
        <ScheduleClient view={view} editMeta={editMeta} />
      ) : (
        <p style={{ textAlign: 'right', color: 'var(--text-2)' }}>
          לא ניתן לטעון את נתוני הסידור כרגע.
        </p>
      )}
      {pastWeeks.length > 0 && (
        <div className="schedule-controls" style={{ marginTop: 16 }}>
          <Link
            href={`/schedule?w=${pastWeeks[0].id}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '11px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-2)', textDecoration: 'none',
              fontSize: 14, fontWeight: 600,
            }}
          >
            <Icon name="calendar" size={17} /> צפה בשבועות קודמים
          </Link>
        </div>
      )}
    </main>
  )
}
