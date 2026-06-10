import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Defense-in-depth: verify every role/shift-type id the manager submitted for an
 * employee belongs to the manager's OWN workplace, before any write. RLS already
 * blocks cross-workplace inserts, but this catches them at the app tier with a
 * clear Hebrew message instead of a generic failure. Returns an error string or
 * null when everything checks out.
 */
export async function workplaceOwnershipError(
  supabase: SupabaseClient,
  workplaceId: string,
  roleIds: string[],
  shiftTypeIds: string[],
): Promise<string | null> {
  const uniqRoles = [...new Set(roleIds)]
  if (uniqRoles.length > 0) {
    const { data } = await supabase
      .from('roles')
      .select('id')
      .eq('workplace_id', workplaceId)
      .in('id', uniqRoles)
    const owned = new Set((data ?? []).map((r) => r.id as string))
    if (uniqRoles.some((id) => !owned.has(id))) return 'תפקיד שאינו שייך למקום העבודה'
  }

  const uniqShifts = [...new Set(shiftTypeIds)]
  if (uniqShifts.length > 0) {
    const { data } = await supabase
      .from('shift_types')
      .select('id')
      .eq('workplace_id', workplaceId)
      .in('id', uniqShifts)
    const owned = new Set((data ?? []).map((s) => s.id as string))
    if (uniqShifts.some((id) => !owned.has(id))) return 'סוג משמרת שאינו שייך למקום העבודה'
  }

  return null
}
