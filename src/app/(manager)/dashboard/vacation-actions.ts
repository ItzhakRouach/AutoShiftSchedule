'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkplace } from '@/lib/workplace/current'

type Result = { ok: true } | { error: string }

/** Approve or reject a pending vacation. Manager-only, scoped to the vacation's
 *  employee belonging to the manager's active workplace. Uses the admin client
 *  (vacation rows are RLS-scoped to their employee) AFTER the scope check. */
async function setVacationStatus(id: string, status: 'approved' | 'rejected'): Promise<Result> {
  if (!id) return { error: 'מזהה חופשה חסר' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה' }

  const admin = createAdminClient()
  const { data: vac } = await admin
    .from('employee_vacations')
    .select('id, employee_id')
    .eq('id', id)
    .maybeSingle()
  if (!vac) return { error: 'בקשת החופשה לא נמצאה' }

  // The vacation's employee must belong to the manager's active workplace.
  const { data: emp } = await admin
    .from('employees')
    .select('workplace_id')
    .eq('id', vac.employee_id)
    .maybeSingle()
  if (!emp || emp.workplace_id !== workplace.id) return { error: 'אין הרשאה' }

  const { error } = await admin.from('employee_vacations').update({ status }).eq('id', id)
  if (error) return { error: 'שגיאה בעדכון החופשה' }

  revalidatePath('/dashboard')
  return { ok: true }
}

export async function approveVacation(id: string): Promise<Result> {
  return setVacationStatus(id, 'approved')
}

export async function rejectVacation(id: string): Promise<Result> {
  return setVacationStatus(id, 'rejected')
}
