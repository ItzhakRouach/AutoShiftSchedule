'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type DeleteAccountState = {
  error?: string
}

export async function deleteMyAccount(): Promise<DeleteAccountState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Verify the user is actually an employee (has a linked employees row)
  const { data: employees, error: lookupError } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', user.id)

  if (lookupError) return { error: 'שגיאה בבדיקת פרטי העובד' }
  if (!employees || employees.length === 0) return { error: 'לא נמצא חשבון עובד מקושר' }

  const admin = createAdminClient()

  // Delete all employees rows for this user (may span multiple workplaces)
  const { error: deleteEmpError } = await admin
    .from('employees')
    .delete()
    .eq('user_id', user.id)

  if (deleteEmpError) return { error: 'שגיאה במחיקת נתוני העובד' }

  // Delete the auth user — this is irreversible
  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteAuthError) return { error: 'שגיאה במחיקת החשבון' }

  // Sign out the local session (best-effort; the auth user is already gone)
  await supabase.auth.signOut()

  redirect('/login')
}
