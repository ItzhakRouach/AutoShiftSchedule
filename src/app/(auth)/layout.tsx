import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveUserRole } from '@/lib/auth/role'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { user, role } = await resolveUserRole(supabase)

  if (user) {
    if (role === 'manager') redirect('/dashboard')
    if (role === 'employee') redirect('/me')
    redirect('/onboarding')
  }

  return <>{children}</>
}
