import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { DeadlineForm } from './DeadlineForm'
import { HolidaysSection } from './HolidaysSection'
import { PublishSettings } from './PublishSettings'
import { RequirementsSection } from './RequirementsSection'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) redirect('/onboarding')

  const [
    { data: settings },
    { data: holidays },
    { data: shiftTypes },
    { data: roles },
    { data: requirements },
  ] = await Promise.all([
    supabase
      .from('workplace_settings')
      .select(
        'request_deadline_dow, request_deadline_time, publish_dow, publish_time, greenapi_instance, greenapi_token, greenapi_group',
      )
      .eq('workplace_id', workplace.id)
      .maybeSingle(),
    supabase
      .from('holidays')
      .select('id, date, name')
      .eq('workplace_id', workplace.id)
      .order('date', { ascending: true }),
    supabase
      .from('shift_types')
      .select('id, key, name, color, sort')
      .eq('workplace_id', workplace.id)
      .eq('is_fallback', false)
      .order('sort', { ascending: true }),
    supabase
      .from('roles')
      .select('id, name')
      .eq('workplace_id', workplace.id)
      .order('name', { ascending: true }),
    supabase
      .from('shift_requirements')
      .select('shift_type_id, role_id, count')
      .eq('workplace_id', workplace.id)
      .eq('day_of_week', 0),
  ])

  const currentYear = new Date().getFullYear()
  const baseShifts = shiftTypes ?? []
  const baseRoles = roles ?? []
  const baseRequirements = requirements ?? []

  const section = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: 24,
    boxShadow: 'var(--shadow)',
    marginBottom: 20,
  }

  return (
    <main style={{ padding: 24, background: 'var(--bg)' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', direction: 'rtl' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 24px', color: 'var(--text)' }}>
          הגדרות
        </h1>

        {/* Staffing requirements */}
        <RequirementsSection
          shiftTypes={baseShifts}
          roles={baseRoles}
          requirements={baseRequirements}
        />

        {/* Request deadline */}
        <section style={section}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>
            מועד אחרון להגשת בקשות
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.5 }}>
            הגדר את היום והשעה האחרונים שבהם עובדים יכולים להגיש בקשות לשבוע הקרוב.
            לאחר המועד הזה, תקופת ה-Collecting תינעל אוטומטית.
          </p>
          <DeadlineForm
            initialDow={settings?.request_deadline_dow ?? null}
            initialTime={settings?.request_deadline_time ?? null}
          />
        </section>

        {/* Publish + GreenAPI */}
        <section style={section}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>
            פרסום אוטומטי לווטסאפ
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.5 }}>
            קבע מתי הסידור יפורסם אוטומטית לעובדים. ניתן גם לשלוח ישירות לקבוצת ווטסאפ דרך GreenAPI.
          </p>
          <PublishSettings
            initialDow={settings?.publish_dow ?? null}
            initialTime={settings?.publish_time ?? null}
            initialInstance={settings?.greenapi_instance ?? null}
            initialToken={settings?.greenapi_token ?? null}
            initialGroup={settings?.greenapi_group ?? null}
          />
        </section>

        <HolidaysSection holidays={holidays ?? []} currentYear={currentYear} />
      </div>
    </main>
  )
}
