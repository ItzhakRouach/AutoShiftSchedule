import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Senior role IDs per employee, resilient to the `is_senior` column being
 * absent (code ahead of migration 20260608000002) — returns {} in that case so
 * the team page still renders, with everyone shown as a regular holder.
 */
export async function fetchSeniorRoleIds(
  supabase: SupabaseClient,
  employeeIds: string[],
): Promise<Record<string, string[]>> {
  if (employeeIds.length === 0) return {}
  const { data, error } = await supabase
    .from('employee_roles')
    .select('employee_id, role_id, is_senior')
    .in('employee_id', employeeIds)
    .eq('is_senior', true)
  if (error || !data) return {}
  const out: Record<string, string[]> = {}
  for (const r of data as { employee_id: string; role_id: string }[]) {
    ;(out[r.employee_id] ??= []).push(r.role_id)
  }
  return out
}

/**
 * Syncs the employee_roles junction table to exactly match `desiredRoleIds`,
 * and sets each row's `is_senior` flag from `seniorRoleIds` (a subset of
 * desiredRoleIds). Deletes removed roles, inserts added roles, and updates the
 * senior flag on rows whose tier changed. Returns an error string on failure,
 * or null on success.
 */
export async function syncEmployeeRoles(
  supabase: SupabaseClient,
  employeeId: string,
  desiredRoleIds: string[],
  seniorRoleIds: string[] = [],
): Promise<string | null> {
  const { data: currentRoles } = await supabase
    .from('employee_roles')
    .select('role_id, is_senior')
    .eq('employee_id', employeeId)

  const existing = new Map<string, boolean>(
    (currentRoles ?? []).map((r: { role_id: string; is_senior?: boolean }) => [r.role_id, r.is_senior ?? false]),
  )
  const newRoleIds = new Set(desiredRoleIds)
  const seniorSet = new Set(seniorRoleIds.filter((id) => newRoleIds.has(id)))

  const toDelete = [...existing.keys()].filter((rid) => !newRoleIds.has(rid))
  const toInsert = [...newRoleIds].filter((rid) => !existing.has(rid))
  // Rows that stay but whose senior flag flipped.
  const toUpdate = [...newRoleIds].filter(
    (rid) => existing.has(rid) && existing.get(rid) !== seniorSet.has(rid),
  )

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('employee_roles')
      .delete()
      .eq('employee_id', employeeId)
      .in('role_id', toDelete)
    if (error) return 'שגיאה בעדכון התפקידים'
  }

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from('employee_roles')
      .insert(toInsert.map((role_id) => ({ employee_id: employeeId, role_id, is_senior: seniorSet.has(role_id) })))
    if (error) return 'שגיאה בעדכון התפקידים'
  }

  for (const rid of toUpdate) {
    const { error } = await supabase
      .from('employee_roles')
      .update({ is_senior: seniorSet.has(rid) })
      .eq('employee_id', employeeId)
      .eq('role_id', rid)
    if (error) return 'שגיאה בעדכון התפקידים'
  }

  return null
}
