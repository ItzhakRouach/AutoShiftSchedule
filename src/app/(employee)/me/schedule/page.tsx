import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/user'
import { getPublishedScheduleView, listPublishedWeeks } from '@/lib/schedule/published-view'
import { countMyRoles } from '@/lib/stats/my-role-counts'
import { ScheduleGrids } from '@/app/(manager)/schedule/ScheduleGrids'
import { WeekNav } from '@/app/(manager)/schedule/WeekNav'
import { MyRoleCounts } from './MyRoleCounts'
import { GuardPaySyncCard } from './GuardPaySyncCard'
import { Card } from '@/components/ui/Card'

// Always reflect the current published state (no stale schedule after the
// manager unpublishes/clears).
export const dynamic = 'force-dynamic'

export default async function MeSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>
}) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('id, workplace_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!employee) redirect('/onboarding')

  // Viewing the schedule clears the "new schedule published" banner on /me.
  await supabase
    .from('schedule_seen')
    .upsert({ employee_id: employee.id, seen_at: new Date().toISOString() }, { onConflict: 'employee_id' })

  // Week navigator: pick the requested published week (?w=) or the latest.
  const weeks = await listPublishedWeeks(supabase, employee.workplace_id)
  const sp = await searchParams
  const selectedId = sp?.w && weeks.some((w) => w.id === sp.w) ? sp.w : weeks[0]?.id
  const view = selectedId ? await getPublishedScheduleView(supabase, employee.workplace_id, selectedId) : null
  const myNotes = (view?.dayNotes ?? []).filter((n) => n.employeeId === employee.id)
  const myRoleCounts = view ? countMyRoles(view, employee.id) : { roles: [], total: 0 }

  const { data: gpLink } = await supabase
    .from('guardpay_links')
    .select('guardpay_name')
    .eq('employee_id', employee.id)
    .maybeSingle()
  const { data: gpSync } = selectedId
    ? await supabase
        .from('guardpay_syncs')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('period_id', selectedId)
        .maybeSingle()
    : { data: null }

  // No published period at all yet (not even a past one) — show a dedicated
  // page-level empty state instead of the header + grid wrapper with an empty
  // card buried inside. Workplaces WITH published periods keep the full
  // header/week-nav/grid layout untouched, even if the currently selected
  // week has no view (handled further below).
  if (weeks.length === 0) {
    return (
      <main className="schedule-main" style={{ background: 'var(--bg)', direction: 'rtl' }}>
        <div className="schedule-controls">
          <Card style={{ textAlign: 'center', padding: 32 }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
              עדיין לא פורסם סידור עבודה
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
              המנהל עדיין לא פרסם סידור עבודה. ברגע שיפורסם, הוא יופיע כאן.
            </p>
          </Card>
        </div>
      </main>
    )
  }

  // Layout mirrors the manager's `/schedule` page exactly so the WeekTable
  // renders at the same width on every breakpoint: outer `.schedule-main`
  // wrapper (560px mobile / 1200px desktop) with an inner `.schedule-controls`
  // band for the page header + per-employee notes. Same component, same CSS
  // tokens, same RTL direction — employees see the schedule in the identical
  // typography and layout the manager does.
  return (
    <main className="schedule-main" style={{ background: 'var(--bg)', direction: 'rtl' }}>
      <div className="schedule-controls">
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
            הסידור השבועי
          </h1>
          {selectedId && weeks.length > 0 && <WeekNav weeks={weeks} selectedId={selectedId} />}
        </div>

        {myNotes.length > 0 && (
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myNotes.map((n) => (
              <div
                key={`${n.day}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 14px',
                  borderRadius: 'var(--r-md)',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    borderRadius: 8,
                    padding: '2px 8px',
                    fontSize: 12,
                  }}
                >
                  {view!.days[n.day]?.short ?? ''}
                </span>
                {n.label}
              </div>
            ))}
          </div>
        )}

        {view && <MyRoleCounts roles={myRoleCounts.roles} total={myRoleCounts.total} />}

        {view && (
          <GuardPaySyncCard
            periodId={view.periodId}
            linked={!!gpLink}
            linkedName={gpLink?.guardpay_name ?? null}
            synced={!!gpSync}
            hasShifts={myRoleCounts.total > 0}
          />
        )}
      </div>

      {view ? (
        <>
          <div style={{ height: 14 }} />
          {/* Read-only, responsive: week table on desktop, per-day cards on
              mobile (no sideways scroll). Employees default to the day view on
              mobile; selfId highlights the worker's own shifts. */}
          <ScheduleGrids view={view} selfId={employee.id} defaultLayout="day" />
        </>
      ) : (
        <div className="schedule-controls">
          <Card style={{ textAlign: 'center', padding: 32, color: 'var(--text-2)' }}>
            אין סידור מפורסם עדיין. הסידור יופיע כאן ברגע שהמנהל יפרסם אותו.
          </Card>
        </div>
      )}
    </main>
  )
}
