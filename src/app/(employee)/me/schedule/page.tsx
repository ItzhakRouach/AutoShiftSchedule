import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPublishedScheduleView } from '@/lib/schedule/published-view'
import { WeekTable } from '@/app/(manager)/schedule/WeekTable'
import { Card } from '@/components/ui/Card'

export default async function MeSchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('id, workplace_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!employee) redirect('/onboarding')

  const view = await getPublishedScheduleView(supabase, employee.workplace_id)
  const weekLabel = view ? `${view.days[0]?.date} – ${view.days[6]?.date}` : ''
  const myNotes = (view?.dayNotes ?? []).filter((n) => n.employeeId === employee.id)

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
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
            הסידור השבועי
          </h1>
          {weekLabel && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>שבוע {weekLabel}</p>
          )}
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
      </div>

      {view ? (
        <>
          <div style={{ height: 14 }} />
          <WeekTable view={view} initialSelectedId={employee.id} showUnfilled={false} />
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
