import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/(auth)/actions'

export default async function MePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Concurrent render safety — layout may not have resolved its redirect yet.
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('name, workplace_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!employee) redirect('/onboarding')

  // Employees can read their own workplace via RLS policy `workplaces_employee_select`
  // (see migration 20260531000005). No admin/service-role bypass needed.
  const { data: workplace } = await supabase
    .from('workplaces')
    .select('name')
    .eq('id', employee.workplace_id)
    .maybeSingle()

  const workplaceName = workplace?.name ?? ''

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
          maxWidth: 480,
          width: '100%',
          direction: 'rtl',
        }}
      >
        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800 }}>
          שלום, {employee.name}!
        </h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-2)', fontSize: 14 }}>
          {workplaceName}
        </p>

        <div
          style={{
            padding: '18px 20px',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-2)',
            fontSize: 14,
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          הסידור והבקשות שלך — בקרוב
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
