'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type DeleteAccountState = {
  error?: string
}

/**
 * Delete the current manager's account: removes their organization (which
 * cascades to workplaces → employees → schedules) and the auth user. Irreversible.
 */
export async function deleteManagerAccount(): Promise<DeleteAccountState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Delete the org(s) this user owns → cascades workplaces, employees, schedules.
  const { error: orgErr } = await admin
    .from('organizations')
    .delete()
    .eq('owner_user_id', user.id)
  if (orgErr) return { error: 'שגיאה במחיקת הארגון' }

  // Detach any employee rows still linked to this user (other workplaces).
  await admin.from('employees').update({ user_id: null }).eq('user_id', user.id)

  // Delete the auth user — irreversible.
  const { error: authErr } = await admin.auth.admin.deleteUser(user.id)
  if (authErr) return { error: 'שגיאה במחיקת החשבון' }

  await supabase.auth.signOut()
  redirect('/login')
}
