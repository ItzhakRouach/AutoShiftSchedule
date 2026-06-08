import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { fetchSeniorRoleIds } from '@/lib/employees/roles'
import { getLatestInvite } from './invite-actions'
import { TeamClient } from './TeamClient'
import { InvitePanel } from './InvitePanel'
import type { RoleOption, EmployeeData } from './EmployeeEditor'
import type { ShiftTypeOption } from './AvailabilityGrid'
import type { AvailabilityItem } from '@/lib/validation/employee'
import type { EmploymentType } from '@/lib/validation/employee'

export default async function TeamPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) redirect('/onboarding')

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `${proto}://${host}`

  const latestInvite = await getLatestInvite(workplace.id)

  // Fetch roles
  const { data: rolesRaw } = await supabase
    .from('roles')
    .select('id, name, color, rank')
    .eq('workplace_id', workplace.id)
    .order('name')

  const roles: RoleOption[] = (rolesRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    rank: r.rank ?? 1,
  }))

  // Fetch base (non-fallback) shift types for this workplace, ordered by
  // start hour so the custom-availability matrix reads בוקר → צהריים → לילה
  // (07 → 15 → 23) instead of the unpredictable Hebrew-name alphabetic order.
  const { data: shiftTypesRaw } = await supabase
    .from('shift_types')
    .select('id, name')
    .eq('workplace_id', workplace.id)
    .eq('is_fallback', false)
    .order('start_hour')

  const shiftTypes: ShiftTypeOption[] = (shiftTypesRaw ?? []).map((st) => ({
    id: st.id,
    name: st.name,
  }))

  // Fetch employees with role_ids
  const { data: employeesRaw } = await supabase
    .from('employees')
    .select('id, name, phone, color, min_shifts_per_week, max_shifts_per_week, employment_type, observes_shabbat, observes_holidays, must_accept, status, employee_roles(role_id)')
    .eq('workplace_id', workplace.id)
    .order('name')

  // Fetch all availability rows for the workplace in one query
  const employeeIds = (employeesRaw ?? []).map((e) => e.id)
  const { data: availRaw } = employeeIds.length > 0
    ? await supabase
        .from('employee_availability')
        .select('employee_id, day_of_week, shift_type_id')
        .in('employee_id', employeeIds)
    : { data: [] }

  // Senior role IDs per employee (resilient to a pre-migration DB).
  const seniorByEmployee = await fetchSeniorRoleIds(supabase, employeeIds)

  // Group availability by employee_id
  const availByEmployee: Record<string, AvailabilityItem[]> = {}
  for (const row of availRaw ?? []) {
    if (!availByEmployee[row.employee_id]) availByEmployee[row.employee_id] = []
    availByEmployee[row.employee_id].push({
      dayOfWeek: row.day_of_week,
      shiftTypeId: row.shift_type_id,
    })
  }

  const VALID_TYPES: EmploymentType[] = ['full', 'part', 'student']

  const employees: EmployeeData[] = (employeesRaw ?? []).map((e) => {
    const rawType = e.employment_type as string
    const empType: EmploymentType = (VALID_TYPES as string[]).includes(rawType)
      ? (rawType as EmploymentType)
      : 'full'
    const empAvail = availByEmployee[e.id] ?? null
    return {
      id: e.id,
      name: e.name,
      phone: e.phone ?? null,
      color: e.color,
      minShifts: e.min_shifts_per_week ?? 0,
      maxShifts: e.max_shifts_per_week ?? null,
      employmentType: empType,
      observesShabbat: e.observes_shabbat ?? false,
      observesHolidays: e.observes_holidays ?? false,
      mustAccept: e.must_accept ?? false,
      status: e.status,
      roleIds: (e.employee_roles ?? []).map((er: { role_id: string }) => er.role_id),
      seniorRoleIds: seniorByEmployee[e.id] ?? [],
      // null means no rows existed = unrestricted; [] means explicitly empty (shouldn't occur)
      availability: empAvail && empAvail.length > 0 ? empAvail : null,
    }
  })

  return (
    <main className="page-wrap wide" style={{ direction: 'rtl' }}>
      <InvitePanel
        initialCode={latestInvite?.code ?? null}
        workplaceName={workplace.name}
        baseUrl={baseUrl}
      />

      <TeamClient employees={employees} roles={roles} shiftTypes={shiftTypes} />
    </main>
  )
}
