import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/role'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getUserRole(supabase)

  if (role === 'manager') redirect('/dashboard')
  if (role === 'none') redirect('/onboarding')
  // role === 'employee' → render

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {children}
    </div>
  )
}
