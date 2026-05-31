import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Users who already have an org belong on the dashboard, not onboarding.
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (org) {
    redirect('/dashboard')
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {children}
    </div>
  )
}
