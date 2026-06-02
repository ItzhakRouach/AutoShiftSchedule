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

  return (
    <main className="page-wrap wide" style={{ direction: 'rtl' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
          הסידור השבועי
        </h1>
        {weekLabel && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>שבוע {weekLabel}</p>}
      </div>

      {view ? (
        <WeekTable view={view} initialSelectedId={employee.id} showUnfilled={false} />
      ) : (
        <Card style={{ textAlign: 'center', padding: 32, color: 'var(--text-2)' }}>
          אין סידור מפורסם עדיין. הסידור יופיע כאן ברגע שהמנהל יפרסם אותו.
        </Card>
      )}
    </main>
  )
}
