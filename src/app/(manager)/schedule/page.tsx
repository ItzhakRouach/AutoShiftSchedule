import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { getScheduleView } from '@/lib/schedule/view-data'
import { ScheduleClient } from './ScheduleClient'

export default async function SchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) redirect('/onboarding')

  const view = await getScheduleView(supabase, workplace.id)

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        padding: '24px 20px',
        maxWidth: 520,
        margin: '0 auto',
        direction: 'rtl',
      }}
    >
      <Link
        href="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 20,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-2)',
          textDecoration: 'none',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: 'scaleX(-1)' }}
        >
          <path d="M14.5 5 8 12l6.5 7" />
        </svg>
        חזרה לדשבורד
      </Link>

      {view ? (
        <ScheduleClient view={view} />
      ) : (
        <p style={{ textAlign: 'right', color: 'var(--text-2)' }}>
          לא ניתן לטעון את נתוני השיבוץ כרגע.
        </p>
      )}
    </main>
  )
}
