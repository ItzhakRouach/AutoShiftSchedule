import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Syncs the employee_roles junction table to exactly match `desiredRoleIds`.
 * Deletes removed roles, inserts added roles — no-ops for unchanged ones.
 * Returns an error string on failure, or null on success.
 */
export async function syncEmployeeRoles(
  supabase: SupabaseClient,
  employeeId: string,
  desiredRoleIds: string[],
): Promise<string | null> {
  const { data: currentRoles } = await supabase
    .from('employee_roles')
    .select('role_id')
    .eq('employee_id', employeeId)

  const existingRoleIds = new Set(
    (currentRoles ?? []).map((r: { role_id: string }) => r.role_id),
  )
  const newRoleIds = new Set(desiredRoleIds)

  const toDelete = [...existingRoleIds].filter((rid) => !newRoleIds.has(rid))
  const toInsert = [...newRoleIds].filter((rid) => !existingRoleIds.has(rid))

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
      .insert(toInsert.map((role_id) => ({ employee_id: employeeId, role_id })))
    if (error) return 'שגיאה בעדכון התפקידים'
  }

  return null
}
