'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkplace } from '@/lib/workplace/current'
import type { EmployeeActionState } from './actions'

export async function deleteEmployee(id: string): Promise<EmployeeActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify ownership: fetch employee only if it belongs to the manager's workplace.
  // RLS enforces this at the DB level too, but we also need user_id for auth deletion.
  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה' }

  const { data: employee, error: fetchError } = await supabase
    .from('employees')
    .select('id, user_id')
    .eq('id', id)
    .eq('workplace_id', workplace.id)
    .maybeSingle()

  if (fetchError) return { error: 'שגיאה במחיקת עובד' }
  if (!employee) return { error: 'העובד לא נמצא' }

  const linkedUserId = employee.user_id as string | null

  const { data: deleted, error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) return { error: 'שגיאה במחיקת עובד' }
  if (!deleted || deleted.length === 0) return { error: 'העובד לא נמצא' }

  // If the employee had a linked auth user, delete it too (admin bypasses RLS).
  // We already verified the employee belongs to this manager's workplace above.
  if (linkedUserId) {
    const admin = createAdminClient()
    await admin.auth.admin.deleteUser(linkedUserId)
    // Non-fatal: best-effort. The employees row is already gone.
  }

  revalidatePath('/team')
  return { ok: true }
}
