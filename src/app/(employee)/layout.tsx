import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveUserRole } from '@/lib/auth/role'
import { EmployeeTopNav } from '@/components/nav/TopNav'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { user, role } = await resolveUserRole(supabase)

  if (!user) redirect('/login')
  if (role === 'manager') redirect('/dashboard')
  if (role === 'none') redirect('/onboarding')
  // role === 'employee' → render

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <EmployeeTopNav />
      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  )
}
