import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSeed } from './seed'

const SETUP_ERROR = 'שגיאה בהקמת מקום העבודה'

export type CreateWorkplaceResult = { id: string } | { error: string }

/**
 * Create a workplace under an existing org and seed it with the default roles,
 * shift types, settings, and staffing requirements. Used by onboarding (first
 * workplace) and the "add workplace" flow. On any failure the partially-created
 * workplace is deleted (cascades its children) so a retry can succeed.
 *
 * Uses the caller's RLS-bound client — the manager owns the org, so
 * `owns_workplace` permits all inserts.
 */
export async function createWorkplaceWithDefaults(
  supabase: SupabaseClient,
  orgId: string,
  name: string,
  timezone = 'Asia/Jerusalem',
): Promise<CreateWorkplaceResult> {
  const { data: workplace, error: workplaceError } = await supabase
    .from('workplaces')
    .insert({ org_id: orgId, name, timezone })
    .select('id')
    .single()
  if (workplaceError || !workplace) return { error: SETUP_ERROR }

  const workplaceId = workplace.id
  const fail = async (message: string): Promise<CreateWorkplaceResult> => {
    await supabase.from('workplaces').delete().eq('id', workplaceId)
    return { error: message }
  }

  const seed = buildSeed()

  const { data: insertedRoles, error: rolesError } = await supabase
    .from('roles')
    .insert(seed.roles.map((r) => ({ workplace_id: workplaceId, name: r.name, color: r.color, rank: r.rank })))
    .select('id, name')
  if (rolesError || !insertedRoles) return fail(SETUP_ERROR)

  const { data: insertedShiftTypes, error: shiftTypesError } = await supabase
    .from('shift_types')
    .insert(
      seed.shiftTypes.map((s) => ({
        workplace_id: workplaceId,
        key: s.key,
        name: s.name,
        start_hour: s.start_hour,
        hours: s.hours,
        color: s.color,
        is_fallback: s.is_fallback,
        sort: s.sort,
      })),
    )
    .select('id, key')
  if (shiftTypesError || !insertedShiftTypes) return fail(SETUP_ERROR)

  const { error: settingsError } = await supabase
    .from('workplace_settings')
    .insert({ workplace_id: workplaceId, ...seed.settings })
  if (settingsError) return fail(SETUP_ERROR)

  const roleIdByName = new Map(insertedRoles.map((r) => [r.name, r.id]))
  const shiftTypeIdByKey = new Map(insertedShiftTypes.map((s) => [s.key, s.id]))

  const requirementRows = []
  for (const req of seed.requirements) {
    const shiftTypeId = shiftTypeIdByKey.get(req.shiftKey)
    const roleId = roleIdByName.get(req.roleName)
    if (!shiftTypeId || !roleId) return fail(SETUP_ERROR)
    requirementRows.push({
      workplace_id: workplaceId,
      day_of_week: req.day_of_week,
      shift_type_id: shiftTypeId,
      role_id: roleId,
      count: req.count,
    })
  }

  const { error: reqError } = await supabase.from('shift_requirements').insert(requirementRows)
  if (reqError) return fail(SETUP_ERROR)

  return { id: workplaceId }
}
