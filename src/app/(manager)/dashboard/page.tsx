import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { signOut } from '@/app/(auth)/actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // The (manager) layout already guards user+org, but this page can render
  // concurrently with the layout (and before its redirect resolves), so it must
  // be self-safe and never dereference a null user.
  if (!user) {
    redirect('/login')
  }

  // Use the shared helper for org → workplace resolution
  const workplace = await getActiveWorkplace(supabase)
  const workplaceId = workplace?.id ?? null

  const [{ count: rolesCount }, { count: shiftTypesCount }, { count: employeesCount }] =
    await Promise.all([
      workplaceId
        ? supabase
            .from('roles')
            .select('*', { count: 'exact', head: true })
            .eq('workplace_id', workplaceId)
        : Promise.resolve({ count: 0 }),
      workplaceId
        ? supabase
            .from('shift_types')
            .select('*', { count: 'exact', head: true })
            .eq('workplace_id', workplaceId)
        : Promise.resolve({ count: 0 }),
      workplaceId
        ? supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('workplace_id', workplaceId)
        : Promise.resolve({ count: 0 }),
    ])

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          borderRadius: 'var(--r-lg)',
          padding: 32,
          maxWidth: 520,
          width: '100%',
          direction: 'rtl',
        }}
      >
        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, textAlign: 'right' }}>
          {workplace?.name ?? 'דשבורד'}
        </h1>
        <p style={{ margin: '0 0 4px', color: 'var(--text-2)', fontSize: 13, textAlign: 'right' }}>
          שלום, {user?.email}
        </p>

        <div
          style={{
            marginTop: 20,
            marginBottom: 20,
            background: 'var(--surface-2)',
            borderRadius: 'var(--r-sm)',
            padding: '14px 18px',
            fontSize: 14,
            color: 'var(--text)',
            textAlign: 'right',
          }}
        >
          תפקידים: {rolesCount ?? 0} · סוגי משמרת: {shiftTypesCount ?? 0} · עובדים:{' '}
          {employeesCount ?? 0}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          <Link
            href="/team"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              borderRadius: 'var(--r-md)',
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
              border: '1px solid transparent',
            }}
          >
            <span>ניהול עובדים</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: 'scaleX(-1)' }}
            >
              <path d="M14.5 5 8 12l6.5 7" />
            </svg>
          </Link>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-pill)',
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            יציאה
          </button>
        </form>
      </div>
    </main>
  )
}
