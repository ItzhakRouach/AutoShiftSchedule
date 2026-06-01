import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { getScheduleView } from '@/lib/schedule/view-data'
import { getEditMeta } from '@/lib/schedule/edit-meta'
import { ScheduleClient } from './ScheduleClient'

export default async function SchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) redirect('/onboarding')

  const view = await getScheduleView(supabase, workplace.id)
  const editMeta = view ? await getEditMeta(supabase, workplace.id, view.periodId) : null

  return (
    <main className="schedule-main" style={{ background: 'var(--bg)', direction: 'rtl' }}>
      {view ? (
        <ScheduleClient view={view} editMeta={editMeta} />
      ) : (
        <p style={{ textAlign: 'right', color: 'var(--text-2)' }}>
          לא ניתן לטעון את נתוני השיבוץ כרגע.
        </p>
      )}
    </main>
  )
}
