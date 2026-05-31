import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { DeadlineForm } from './DeadlineForm'
import { HolidaysSection } from './HolidaysSection'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) redirect('/onboarding')

  const [{ data: settings }, { data: holidays }] = await Promise.all([
    supabase
      .from('workplace_settings')
      .select('request_deadline_dow, request_deadline_time')
      .eq('workplace_id', workplace.id)
      .maybeSingle(),
    supabase
      .from('holidays')
      .select('id, date, name')
      .eq('workplace_id', workplace.id)
      .order('date', { ascending: true }),
  ])

  const initialDow: number | null = settings?.request_deadline_dow ?? null
  const initialTime: string | null = settings?.request_deadline_time ?? null
  const currentYear = new Date().getFullYear()

  return (
    <main style={{ minHeight: '100vh', padding: 24, background: 'var(--bg)' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', direction: 'rtl' }}>
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/dashboard"
            style={{ color: 'var(--accent)', fontSize: 14, textDecoration: 'none' }}
          >
            ← חזרה לדשבורד
          </Link>
        </div>

        <h1
          style={{ fontSize: 24, fontWeight: 800, margin: '0 0 24px', color: 'var(--text)' }}
        >
          הגדרות
        </h1>

        <section
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: 24,
            boxShadow: 'var(--shadow)',
          }}
        >
          <h2
            style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}
          >
            מועד אחרון להגשת בקשות
          </h2>
          <p
            style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.5 }}
          >
            הגדר את היום והשעה האחרונים שבהם עובדים יכולים להגיש בקשות לשבוע הקרוב.
            לאחר המועד הזה, תקופת ה-Collecting תינעל אוטומטית.
          </p>
          <DeadlineForm initialDow={initialDow} initialTime={initialTime} />
        </section>

        <HolidaysSection
          holidays={holidays ?? []}
          currentYear={currentYear}
        />
      </div>
    </main>
  )
}
