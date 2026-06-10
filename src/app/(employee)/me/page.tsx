import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/user'
import { signOut } from '@/app/(auth)/actions'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Card } from '@/components/ui/Card'
import { DeleteAccountButton } from '@/components/account/DeleteAccountButton'
import { getMeSummary, getMeStats } from '@/lib/stats/me-summary-data'
import { upcomingWeekStartISO } from '@/lib/dates/week'
import { deadlineLabel } from '@/lib/deadline/compute'
import { deleteMyAccount } from './actions'
import { MeSummary } from './MeSummary'
import { MeStats } from './MeStats'

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
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, workplace_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!employee) redirect('/onboarding')

  const [{ data: workplace }, { data: settings }, summaryData, statsData] = await Promise.all([
    supabase.from('workplaces').select('name, timezone').eq('id', employee.workplace_id).maybeSingle(),
    supabase
      .from('workplace_settings')
      .select('request_deadline_dow, request_deadline_time')
      .eq('workplace_id', employee.workplace_id)
      .maybeSingle(),
    getMeSummary(supabase, employee.id, employee.workplace_id),
    getMeStats(supabase, employee.id, employee.workplace_id),
  ])

  const dDow = settings?.request_deadline_dow as number | null | undefined
  const dTime = settings?.request_deadline_time as string | null | undefined
  const tz = (workplace?.timezone as string | null) ?? 'Asia/Jerusalem'
  const deadline =
    dDow != null && dTime
      ? deadlineLabel(upcomingWeekStartISO(new Date()), dDow, dTime, tz)
      : null

  return (
    <main className="page-wrap narrow" style={{ direction: 'rtl' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'var(--text-h1)', fontWeight: 800, letterSpacing: '-0.5px' }}>
          שלום, {employee.name}!
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>{workplace?.name ?? ''}</p>
      </div>

      {deadline && (
        <Link href="/me/requests" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
          <Card interactive style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
            <Icon name="bell" size={20} stroke={1.9} color="var(--accent)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>מועד אחרון להגשת בקשות</div>
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginTop: 1 }}>{deadline}</div>
            </div>
            <Icon name="chevronLeft" size={17} color="var(--text-3)" />
          </Card>
        </Link>
      )}

      {summaryData && <MeSummary summary={summaryData.summary} roles={summaryData.roles} />}

      <MeStats data={statsData} />

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
