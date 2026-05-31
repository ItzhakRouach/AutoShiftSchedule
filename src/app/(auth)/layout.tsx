import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/role'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const role = await getUserRole(supabase)
    if (role === 'manager') redirect('/dashboard')
    if (role === 'employee') redirect('/me')
    redirect('/onboarding')
  }

  return <>{children}</>
}
