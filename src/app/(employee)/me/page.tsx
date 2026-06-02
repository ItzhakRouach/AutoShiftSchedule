import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/(auth)/actions'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Card } from '@/components/ui/Card'
import { DeleteAccountButton } from '@/components/account/DeleteAccountButton'
import { getMeSummary } from '@/lib/stats/me-summary-data'
import { deleteMyAccount } from './actions'
import { MeSummary } from './MeSummary'

function NavCard({ href, icon, title, subtitle }: { href: string; icon: IconName; title: string; subtitle: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
      <Card style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', cursor: 'pointer' }} interactive>
        <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
          <Icon name={icon} size={22} stroke={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>{subtitle}</div>
        </div>
        <Icon name="chevronLeft" size={18} color="var(--text-3)" />
      </Card>
    </Link>
  )
}

export default async function MePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, workplace_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!employee) redirect('/onboarding')

  const [{ data: workplace }, summaryData] = await Promise.all([
    supabase.from('workplaces').select('name').eq('id', employee.workplace_id).maybeSingle(),
    getMeSummary(supabase, employee.id, employee.workplace_id),
  ])

  return (
    <main className="page-wrap narrow" style={{ direction: 'rtl' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
          שלום, {employee.name}!
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>{workplace?.name ?? ''}</p>
      </div>

      {summaryData && <MeSummary summary={summaryData.summary} roles={summaryData.roles} />}

      <NavCard href="/me/schedule" icon="grid" title="הסידור השבועי" subtitle="צפייה בסידור העבודה המפורסם" />
      <NavCard href="/me/requests" icon="calendar" title="הגשת בקשות" subtitle="בקשות לשבוע הקרוב" />

      {/* Sign out + delete account */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
        <form action={signOut}>
          <button
            type="submit"
            style={{
              background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, padding: 0,
            }}
          >
            <Icon name="logout" size={15} stroke={1.75} />
            יציאה
          </button>
        </form>
        <DeleteAccountButton action={deleteMyAccount} />
      </div>
    </main>
  )
}
