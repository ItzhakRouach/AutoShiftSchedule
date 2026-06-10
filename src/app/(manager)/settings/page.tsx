import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/user'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { hhmm } from '@/lib/dates/time'
import { signOut } from '@/app/(auth)/actions'
import { DeleteAccountButton } from '@/components/account/DeleteAccountButton'
import { deleteManagerAccount } from './account-actions'
import { DeadlineForm } from './DeadlineForm'
import { HolidaysSection } from './HolidaysSection'
import { PublishSettings } from './PublishSettings'
import { RequirementsSection } from './RequirementsSection'
import { RolesSection } from './RolesSection'
import { ShiftsSection } from './ShiftsSection'
import { WorkingDaysSection } from './WorkingDaysSection'

export default async function SettingsPage() {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
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
        'request_deadline_dow, request_deadline_time, publish_dow, publish_time, working_days, max_off_per_day',
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
      .select('id, key, name, color, sort, start_hour, hours, is_active')
      .eq('workplace_id', workplace.id)
      .eq('is_fallback', false)
      .order('sort', { ascending: true }),
    supabase
      .from('roles')
      .select('id, name, color, rank, is_active')
      .eq('workplace_id', workplace.id)
      .eq('is_active', true)
      .order('rank', { ascending: false }),
    supabase
      .from('shift_requirements')
      .select('shift_type_id, role_id, count')
      .eq('workplace_id', workplace.id)
      .eq('day_of_week', 0),
  ])

  const currentYear = new Date().getFullYear()
  const allBaseShifts = shiftTypes ?? []
  const activeShifts = allBaseShifts.filter((s) => s.is_active !== false)
  const baseRoles = (roles ?? []).map((r) => ({ id: r.id, name: r.name, color: r.color, rank: r.rank ?? 1 }))
  const baseRequirements = requirements ?? []
  const workingDays = (settings?.working_days as number[] | null) ?? [0, 1, 2, 3, 4, 5, 6]

  const section = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: 24,
    boxShadow: 'var(--shadow)',
    marginBottom: 20,
  }

  return (
    <main style={{ background: 'var(--bg)' }}>
      <div className="page-wrap wide" style={{ direction: 'rtl', maxWidth: 920 }}>
        <h1 style={{ fontSize: 'var(--text-h1)', fontWeight: 800, margin: '0 0 24px', color: 'var(--text)' }}>
          הגדרות
        </h1>

        {/* Roles */}
        <RolesSection roles={baseRoles} />

        {/* Shifts */}
        <ShiftsSection shifts={allBaseShifts} />

        {/* Working days */}
        <WorkingDaysSection initialDays={workingDays} />

        {/* Staffing requirements (active shifts × active roles) */}
        <RequirementsSection
          shiftTypes={activeShifts}
          roles={baseRoles}
          requirements={baseRequirements}
        />

        {/* Request deadline */}
        <section style={section}>
          <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>
            מועד אחרון להגשת בקשות
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.5 }}>
            הגדר את היום והשעה האחרונים שבהם עובדים יכולים להגיש בקשות לשבוע הקרוב.
          </p>
          <DeadlineForm
            initialDow={settings?.request_deadline_dow ?? null}
            initialTime={hhmm(settings?.request_deadline_time as string | null) || null}
            initialMaxOffPerDay={(settings?.max_off_per_day as number | null) ?? null}
          />
        </section>

        {/* Publish + WhatsApp (Evolution API) */}
        <section style={section}>
          <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>
            פרסום אוטומטי לווטסאפ
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.5 }}>
            קבע מתי הסידור יפורסם אוטומטית. ניתן לשלוח את תמונת הסידור לקבוצת הווטסאפ
            ולכל עובד הודעה אישית עם המשמרות שלו.
          </p>
          <PublishSettings
            initialDow={settings?.publish_dow ?? null}
            initialTime={hhmm(settings?.publish_time as string | null) || null}
          />
        </section>

        <HolidaysSection holidays={holidays ?? []} currentYear={currentYear} />

        {/* Account */}
        <section style={section}>
          <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>
            חשבון
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.5 }}>
            התנתקות מהמערכת תחזיר אותך למסך הכניסה.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <form action={signOut}>
              <button
                type="submit"
                style={{
                  background: 'none',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--r-pill)',
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                התנתקות
              </button>
            </form>
            <DeleteAccountButton
              action={deleteManagerAccount}
              description="פעולה זו תמחק את הארגון, מקום העבודה, כל העובדים והסידורים — לצמיתות. לא ניתן לבטל."
            />
          </div>
        </section>
      </div>
    </main>
  )
}
