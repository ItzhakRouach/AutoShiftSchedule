import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveUserRole } from '@/lib/auth/role'
import { ManagerTopNav } from '@/components/nav/TopNav'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { user, role } = await resolveUserRole(supabase)

  if (!user) redirect('/login')
  if (role === 'employee') redirect('/me')
  if (role === 'none') redirect('/onboarding')

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <ManagerTopNav />
      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  )
}
