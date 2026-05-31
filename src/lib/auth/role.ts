import type { SupabaseClient, User } from '@supabase/supabase-js'

export type UserRole = 'manager' | 'employee' | 'none'

export interface ResolvedRole {
  user: User | null
  role: UserRole
}

/**
 * Resolves the role of the currently authenticated user, returning both the
 * resolved user and their role so callers (layouts) can avoid a second
 * `auth.getUser()` round-trip.
 *
 * - 'manager'  → user owns an organization
 * - 'employee' → user has at least one employees row linked to them
 * - 'none'     → authenticated but no role assigned yet
 *
 * Pass a pre-resolved `user` to skip the internal `auth.getUser()` call.
 *
 * NOTE: we intentionally use `.limit(1)` + array length instead of
 * `.maybeSingle()`. A user may legitimately have rows in MORE THAN ONE
 * workplace (multi-workplace employee), in which case `.maybeSingle()` throws
 * PGRST116 and the role would wrongly resolve to 'none', locking the user.
 */
export async function resolveUserRole(
  supabase: SupabaseClient,
  preUser?: User | null,
): Promise<ResolvedRole> {
  let user = preUser ?? null
  if (user === null && preUser === undefined) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) return { user: null, role: 'none' }

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_user_id', user.id)
    .limit(1)

  if (orgs && orgs.length > 0) return { user, role: 'manager' }

  const { data: employees } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  if (employees && employees.length > 0) return { user, role: 'employee' }

  return { user, role: 'none' }
}

/** Convenience wrapper returning only the role. */
export async function getUserRole(
  supabase: SupabaseClient,
  preUser?: User | null,
): Promise<UserRole> {
  const { role } = await resolveUserRole(supabase, preUser)
  return role
}
