'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveEmployee } from './requests/request-helpers'

/**
 * Records that the employee has seen the current published schedule, clearing
 * the "סידור חדש פורסם" banner on /me. Called both when they open /me/schedule
 * and when they dismiss the banner. Self-scoped via RLS (schedule_seen policy).
 */
export async function markScheduleSeen(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const employee = await resolveEmployee(supabase, user.id)
  if (!employee) return

  await supabase
    .from('schedule_seen')
    .upsert({ employee_id: employee.id, seen_at: new Date().toISOString() }, { onConflict: 'employee_id' })

  revalidatePath('/me')
}
