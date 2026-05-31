import type { SupabaseClient } from '@supabase/supabase-js'

export interface WorkplaceInfo {
  id: string
  name: string
}

/**
 * Returns the active workplace for the currently authenticated user,
 * or null if the user has no org / workplace yet.
 */
export async function getActiveWorkplace(
  supabase: SupabaseClient,
): Promise<WorkplaceInfo | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (!org) return null

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, name')
    .eq('org_id', org.id)
    .maybeSingle()

  if (!workplace) return null

  return { id: workplace.id, name: workplace.name }
}
