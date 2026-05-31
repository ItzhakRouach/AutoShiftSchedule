import type { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'manager' | 'employee' | 'none'

/**
 * Resolves the role of the currently authenticated user.
 *
 * - 'manager'  → user owns an organization
 * - 'employee' → user has an employees row linked to them
 * - 'none'     → authenticated but no role assigned yet
 *
 * Returns 'none' when there is no authenticated user.
 */
export async function getUserRole(supabase: SupabaseClient): Promise<UserRole> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return 'none'

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (org) return 'manager'

  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (employee) return 'employee'

  return 'none'
}
