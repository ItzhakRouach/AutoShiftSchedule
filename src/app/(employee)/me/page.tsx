import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/(auth)/actions'
import { Icon } from '@/components/ui/Icon'
import { Card } from '@/components/ui/Card'
import { DeleteAccountButton } from './DeleteAccountButton'

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

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('name')
    .eq('id', employee.workplace_id)
    .maybeSingle()

  const workplaceName = workplace?.name ?? ''

  return (
    <main
      style={{
        background: 'var(--bg)',
        padding: '24px 20px',
        maxWidth: 520,
        margin: '0 auto',
        direction: 'rtl',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
          שלום, {employee.name}!
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>{workplaceName}</p>
      </div>

      {/* Requests card */}
      <Link href="/me/requests" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
        <Card style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', cursor: 'pointer' }} interactive>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
            <Icon name="calendar" size={22} stroke={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>הגשת בקשות</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>בקשות לשבוע הקרוב</div>
          </div>
          <Icon name="chevronLeft" size={18} color="var(--text-3)" />
        </Card>
      </Link>

      {/* Sign out + delete account */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <form action={signOut}>
          <button
            type="submit"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-3)',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 0,
            }}
          >
            <Icon name="logout" size={15} stroke={1.75} />
            יציאה
          </button>
        </form>
        <DeleteAccountButton />
      </div>
    </main>
  )
}
