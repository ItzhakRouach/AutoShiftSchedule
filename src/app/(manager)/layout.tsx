import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveUserRole } from '@/lib/auth/role'
import { ManagerTopNav } from '@/components/nav/TopNav'
import { listWorkplaces, getActiveWorkplace } from '@/lib/workplace/current'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { user, role } = await resolveUserRole(supabase)

  if (!user) redirect('/login')
  if (role === 'employee') redirect('/me')
  if (role === 'none') redirect('/onboarding')

  const [workplaces, active] = await Promise.all([
    listWorkplaces(supabase),
    getActiveWorkplace(supabase),
  ])

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <ManagerTopNav workplaces={workplaces} activeWorkplaceId={active?.id} />
      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  )
}
