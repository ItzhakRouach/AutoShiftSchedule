import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/role'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getUserRole(supabase)

  if (role === 'manager') redirect('/dashboard')
  if (role === 'employee') redirect('/me')
  // role === 'none' → render onboarding

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {children}
    </div>
  )
}
