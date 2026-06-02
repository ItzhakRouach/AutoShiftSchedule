'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createWorkplaceSchema } from '@/lib/validation/workplace'
import { createWorkplaceWithDefaults } from '@/lib/workplace/create'

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

  // One org per user: if one already exists, never create another.
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (existingOrg) {
    redirect('/dashboard')
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

  // Seed the first workplace under the new org. If it fails, delete the org
  // (cascades) so no orphan remains and a retry can succeed.
  const result = await createWorkplaceWithDefaults(supabase, org.id, workplaceName, timezone)
  if ('error' in result) {
    await supabase.from('organizations').delete().eq('id', org.id)
    return { error: result.error }
  }

  // redirect must be outside try/catch — it throws internally
  redirect('/dashboard')
}
