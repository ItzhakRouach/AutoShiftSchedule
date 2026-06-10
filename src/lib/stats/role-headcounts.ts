import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

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

  const countByRole = new Map<string, number>()
  const seen = new Set<string>()
  for (const row of er ?? []) {
    const k = `${row.role_id}:${row.employee_id}`
    if (seen.has(k)) continue
    seen.add(k)
    countByRole.set(row.role_id, (countByRole.get(row.role_id) ?? 0) + 1)
  }

  return (roles ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string).trim(),
    color: (r.color as string) ?? '#888888',
    count: countByRole.get(r.id as string) ?? 0,
  }))
}
