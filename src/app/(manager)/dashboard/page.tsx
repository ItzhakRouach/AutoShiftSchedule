import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/(auth)/actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { count: workplaceCount } = await supabase
    .from('workplaces')
    .select('*', { count: 'exact', head: true })

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
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800 }}>דשבורד</h1>
        <p style={{ margin: '0 0 4px', color: 'var(--text-2)', fontSize: 14 }}>
          שלום, {user?.email}
        </p>
        <p style={{ margin: '0 0 28px', color: 'var(--text-3)', fontSize: 13 }}>
          מקומות עבודה: {workplaceCount ?? 0}
        </p>
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
