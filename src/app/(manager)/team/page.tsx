import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { getLatestInvite } from './invite-actions'
import { TeamClient } from './TeamClient'
import { InvitePanel } from './InvitePanel'
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

  // Derive base URL from request headers
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `${proto}://${host}`

  // Fetch latest active invite
  const latestInvite = await getLatestInvite(workplace.id)

  // Fetch roles
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

  // Fetch employees with their role_ids
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

      <InvitePanel
        initialCode={latestInvite?.code ?? null}
        workplaceName={workplace.name}
        baseUrl={baseUrl}
      />

      <TeamClient employees={employees} roles={roles} />
    </main>
  )
}
