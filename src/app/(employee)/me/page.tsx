import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/user'
import { signOut } from '@/app/(auth)/actions'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Card } from '@/components/ui/Card'
import { DeleteAccountButton } from '@/components/account/DeleteAccountButton'
import { getMeSummary, getMeStats } from '@/lib/stats/me-summary-data'
import { deadlineLabel } from '@/lib/deadline/compute'
import { resolveCollectionWeek } from '@/lib/requests/collection-week'
import { deleteMyAccount } from './actions'
import { MeSummary } from './MeSummary'
import { MeStats } from './MeStats'
import { PushToggle } from './PushToggle'
import { NewScheduleBanner } from './NewScheduleBanner'

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

  const [{ data: workplace }, week, summaryData, statsData, { data: lastPublished }, { data: seen }] = await Promise.all([
    supabase.from('workplaces').select('name').eq('id', employee.workplace_id).maybeSingle(),
    resolveCollectionWeek(supabase, employee.workplace_id, new Date()),
    getMeSummary(supabase, employee.id, employee.workplace_id),
    getMeStats(supabase, employee.id, employee.workplace_id),
    supabase
      .from('schedule_periods')
      .select('published_at')
      .eq('workplace_id', employee.workplace_id)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('schedule_seen').select('seen_at').eq('employee_id', employee.id).maybeSingle(),
  ])

  // Show the "new schedule" banner when the latest publish is newer than the
  // employee's last look (or they've never looked).
  const publishedAt = lastPublished?.published_at as string | null | undefined
  const seenAt = seen?.seen_at as string | null | undefined
  const hasNewSchedule = !!publishedAt && (!seenAt || publishedAt > seenAt)

  // The deadline banner follows the SAME rolled week as the request form: once
  // this week's deadline passes it advances to next week's, never showing a
  // stale past date.
  const deadline =
    week && week.dow != null && week.time
      ? deadlineLabel(week.weekStart, week.dow, week.time, week.tz)
      : null

  return (
    <main className="page-wrap narrow" style={{ direction: 'rtl' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'var(--text-h1)', fontWeight: 800, letterSpacing: '-0.5px' }}>
          שלום, {employee.name}!
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>{workplace?.name ?? ''}</p>
      </div>

      {hasNewSchedule && <NewScheduleBanner />}

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

      <PushToggle />

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
