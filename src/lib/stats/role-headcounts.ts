import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { expandRolesByRank } from '@/lib/schedule/role-rank'

export interface RoleHeadcount {
  id: string
  name: string
  color: string
  count: number
}

/**
 * How many employees hold each ACTIVE role in a workplace (hybrid — whatever
 * roles this workplace defined). Distinct employees per role. Elevated client
 * (employee_roles are RLS-scoped); caller passes the manager's own workplace id.
 */
export async function getRoleHeadcounts(
  admin: SupabaseClient,
  workplaceId: string,
): Promise<RoleHeadcount[]> {
  const { data: roles } = await admin
    .from('roles')
    .select('id, name, color, rank')
    .eq('workplace_id', workplaceId)
    .eq('is_active', true)
    .order('rank', { ascending: false })

  const { data: emps } = await admin
    .from('employees')
    .select('id')
    .eq('workplace_id', workplaceId)
  const empIds = (emps ?? []).map((e) => e.id as string)

  const { data: er } = empIds.length
    ? await admin.from('employee_roles').select('employee_id, role_id').in('employee_id', empIds)
    : { data: [] as { employee_id: string; role_id: string }[] }

  // Held role ids per employee.
  const heldByEmp = new Map<string, string[]>()
  for (const row of er ?? []) {
    const list = heldByEmp.get(row.employee_id) ?? []
    list.push(row.role_id)
    heldByEmp.set(row.employee_id, list)
  }

  // Count by RANK ELIGIBILITY (matches the scheduler's expandRolesByRank): a
  // higher-rank worker can fill every lower role, so e.g. מאבטח counts everyone.
  const rolesWithRank = (roles ?? []).map((r) => ({ id: r.id as string, rank: r.rank as number | null }))
  const countByRole = new Map<string, number>()
  for (const empId of empIds) {
    for (const roleId of expandRolesByRank(heldByEmp.get(empId) ?? [], rolesWithRank)) {
      countByRole.set(roleId, (countByRole.get(roleId) ?? 0) + 1)
    }
  }

  return (roles ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string).trim(),
    color: (r.color as string) ?? '#888888',
    count: countByRole.get(r.id as string) ?? 0,
  }))
}
