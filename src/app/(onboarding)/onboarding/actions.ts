'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createWorkplaceSchema } from '@/lib/validation/workplace'
import { buildSeed } from '@/lib/workplace/seed'

export type WorkplaceState = {
  error?: string
  fieldErrors?: Record<string, string>
}

export async function createWorkplace(
  prevState: WorkplaceState,
  formData: FormData,
): Promise<WorkplaceState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Validate input
  const raw = {
    orgName: formData.get('orgName') as string,
    workplaceName: formData.get('workplaceName') as string,
    timezone: (formData.get('timezone') as string) || 'Asia/Jerusalem',
  }

  const parsed = createWorkplaceSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0])
      if (!fieldErrors[field]) fieldErrors[field] = issue.message
    }
    return { fieldErrors }
  }

  const { orgName, workplaceName, timezone } = parsed.data

  // Insert organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ owner_user_id: user.id, name: orgName })
    .select('id')
    .single()

  if (orgError || !org) {
    return { error: 'שגיאה ביצירת הארגון' }
  }

  // Insert workplace
  const { data: workplace, error: workplaceError } = await supabase
    .from('workplaces')
    .insert({ org_id: org.id, name: workplaceName, timezone })
    .select('id')
    .single()

  if (workplaceError || !workplace) {
    return { error: 'שגיאה בהקמת מקום העבודה' }
  }

  const workplaceId = workplace.id
  const seed = buildSeed()

  // Insert roles
  const { data: insertedRoles, error: rolesError } = await supabase
    .from('roles')
    .insert(seed.roles.map(r => ({ workplace_id: workplaceId, name: r.name, color: r.color })))
    .select('id, name')

  if (rolesError || !insertedRoles) {
    return { error: 'שגיאה בהקמת מקום העבודה' }
  }

  // Insert shift types
  const { data: insertedShiftTypes, error: shiftTypesError } = await supabase
    .from('shift_types')
    .insert(
      seed.shiftTypes.map(s => ({
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

  if (shiftTypesError || !insertedShiftTypes) {
    return { error: 'שגיאה בהקמת מקום העבודה' }
  }

  // Insert workplace settings
  const { error: settingsError } = await supabase
    .from('workplace_settings')
    .insert({ workplace_id: workplaceId, ...seed.settings })

  if (settingsError) {
    return { error: 'שגיאה בהקמת מקום העבודה' }
  }

  // Build lookup maps
  const roleIdByName = new Map(insertedRoles.map(r => [r.name, r.id]))
  const shiftTypeIdByKey = new Map(insertedShiftTypes.map(s => [s.key, s.id]))

  // Build and insert shift requirements
  const requirementRows = seed.requirements.map(req => ({
    workplace_id: workplaceId,
    day_of_week: req.day_of_week,
    shift_type_id: shiftTypeIdByKey.get(req.shiftKey)!,
    role_id: roleIdByName.get(req.roleName)!,
    count: req.count,
  }))

  const { error: reqError } = await supabase.from('shift_requirements').insert(requirementRows)

  if (reqError) {
    return { error: 'שגיאה בהקמת מקום העבודה' }
  }

  // redirect must be outside try/catch — it throws internally
  redirect('/dashboard')
}
