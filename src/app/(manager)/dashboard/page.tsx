import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  // Fetch org → workplace
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  const { data: workplace } = org
    ? await supabase
        .from('workplaces')
        .select('id, name')
        .eq('org_id', org.id)
        .maybeSingle()
    : { data: null }

  const workplaceId = workplace?.id ?? null

  const [{ count: rolesCount }, { count: shiftTypesCount }] = await Promise.all([
    workplaceId
      ? supabase.from('roles').select('*', { count: 'exact', head: true }).eq('workplace_id', workplaceId)
      : Promise.resolve({ count: 0 }),
    workplaceId
      ? supabase.from('shift_types').select('*', { count: 'exact', head: true }).eq('workplace_id', workplaceId)
      : Promise.resolve({ count: 0 }),
  ])

  // Employees table does not exist yet — hardcoded 0
  const employeesCount = 0

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
            marginBottom: 28,
            background: 'var(--surface-2)',
            borderRadius: 'var(--r-sm)',
            padding: '14px 18px',
            fontSize: 14,
            color: 'var(--text)',
            textAlign: 'right',
          }}
        >
          תפקידים: {rolesCount ?? 0} · סוגי משמרת: {shiftTypesCount ?? 0} · עובדים: {employeesCount}
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
