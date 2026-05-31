import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { TeamClient } from './TeamClient'
import type { RoleOption, EmployeeData } from './EmployeeEditor'

export default async function TeamPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const workplace = await getActiveWorkplace(supabase)

  if (!workplace) {
    redirect('/onboarding')
  }

  // Fetch roles for this workplace
  const { data: rolesRaw } = await supabase
    .from('roles')
    .select('id, name, color')
    .eq('workplace_id', workplace.id)
    .order('name')

  const roles: RoleOption[] = (rolesRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
  }))

  // Fetch employees with their role_ids via employee_roles junction
  const { data: employeesRaw } = await supabase
    .from('employees')
    .select('id, name, phone, color, min_shifts_per_week, observes_shabbat, observes_holidays, must_accept, status, employee_roles(role_id)')
    .eq('workplace_id', workplace.id)
    .order('name')

  const employees: EmployeeData[] = (employeesRaw ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    phone: e.phone ?? null,
    color: e.color,
    minShifts: e.min_shifts_per_week ?? 0,
    observesShabbat: e.observes_shabbat ?? false,
    observesHolidays: e.observes_holidays ?? false,
    mustAccept: e.must_accept ?? false,
    status: e.status,
    roleIds: (e.employee_roles ?? []).map((er: { role_id: string }) => er.role_id),
  }))

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        padding: '24px 20px',
        maxWidth: 520,
        margin: '0 auto',
        direction: 'rtl',
      }}
    >
      {/* Back link */}
      <Link
        href="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 20,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-2)',
          textDecoration: 'none',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: 'scaleX(-1)' }}
        >
          <path d="M14.5 5 8 12l6.5 7" />
        </svg>
        חזרה לדשבורד
      </Link>

      <TeamClient employees={employees} roles={roles} />
    </main>
  )
}
