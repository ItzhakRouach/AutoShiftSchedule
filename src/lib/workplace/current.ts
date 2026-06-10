import { cookies } from 'next/headers'
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth/user'

export interface WorkplaceInfo {
  id: string
  name: string
}

/** Cookie holding the manager's currently-selected workplace id. */
export const ACTIVE_WP_COOKIE = 'active_workplace_id'

// All helpers here are React.cache()-memoized (keyed on the client instance,
// which createClient() also memoizes) so layout + page + nested helpers share
// one round-trip per request instead of re-querying on every call.
const orgIdFor = cache(async (supabase: SupabaseClient): Promise<string | null> => {
  const user = await getAuthUser(supabase)
  if (!user) return null
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle()
  return org?.id ?? null
})

/** All workplaces in the manager's org, oldest first (stable order). */
export const listWorkplaces = cache(async (supabase: SupabaseClient): Promise<WorkplaceInfo[]> => {
  const orgId = await orgIdFor(supabase)
  if (!orgId) return []
  const { data } = await supabase
    .from('workplaces')
    .select('id, name')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
  return (data ?? []).map((w) => ({ id: w.id, name: w.name }))
})

/**
 * Returns the active workplace for the current manager: the one named by the
 * `active_workplace_id` cookie (if it belongs to their org), else the first
 * workplace. Null if the user has no org/workplace yet.
 */
export const getActiveWorkplace = cache(async (
  supabase: SupabaseClient,
): Promise<WorkplaceInfo | null> => {
  const workplaces = await listWorkplaces(supabase)
  if (workplaces.length === 0) return null

  const cookieStore = await cookies()
  const wanted = cookieStore.get(ACTIVE_WP_COOKIE)?.value
  return (wanted && workplaces.find((w) => w.id === wanted)) || workplaces[0]
})
