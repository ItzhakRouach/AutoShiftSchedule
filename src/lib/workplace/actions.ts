'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createWorkplaceWithDefaults } from './create'
import { ACTIVE_WP_COOKIE } from './current'

const COOKIE_OPTS = { path: '/', sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 365 }

async function ownerOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle()
  return org?.id ?? null
}

/** Switch the active workplace (validates it belongs to the manager's org). */
export async function setActiveWorkplace(workplaceId: string): Promise<void> {
  const supabase = await createClient()
  const orgId = await ownerOrgId(supabase)
  if (!orgId) redirect('/login')

  const { data: wp } = await supabase
    .from('workplaces')
    .select('id')
    .eq('id', workplaceId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (!wp) return

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_WP_COOKIE, workplaceId, COOKIE_OPTS)
  revalidatePath('/', 'layout')
}

export type AddWorkplaceState = { error?: string; fieldErrors?: Record<string, string> }

/** Create an additional workplace under the manager's org and switch to it. */
export async function addWorkplace(
  prevState: AddWorkplaceState,
  formData: FormData,
): Promise<AddWorkplaceState> {
  const name = ((formData.get('name') as string) ?? '').trim()
  if (name.length < 2) return { fieldErrors: { name: 'שם קצר מדי (לפחות 2 תווים)' } }
  if (name.length > 80) return { fieldErrors: { name: 'שם ארוך מדי' } }

  const supabase = await createClient()
  const orgId = await ownerOrgId(supabase)
  if (!orgId) redirect('/onboarding')

  const result = await createWorkplaceWithDefaults(supabase, orgId, name)
  if ('error' in result) return { error: result.error }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_WP_COOKIE, result.id, COOKIE_OPTS)
  redirect('/dashboard')
}
