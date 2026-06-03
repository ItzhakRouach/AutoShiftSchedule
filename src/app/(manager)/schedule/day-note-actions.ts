'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'

export interface DayNoteResult {
  ok: boolean
  error?: string
}

const GENERIC = 'אירעה שגיאה. נסו שוב.'
const labelSchema = z.string().trim().min(1, 'יש להזין טקסט').max(40, 'טקסט ארוך מדי')

/**
 * Assign an employee a day note (e.g. רענון / free text) for a given day. The
 * note marks them as NOT working that day, so their existing assignment for that
 * day is removed. Upserts one note per (period, employee, day).
 */
export async function setDayNote(
  periodId: string,
  employeeId: string,
  dayIndex: number,
  label: string,
): Promise<DayNoteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const parsed = labelSchema.safeParse(label)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return { ok: false, error: GENERIC }

  // Ensure the employee belongs to the manager's active workplace.
  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .eq('workplace_id', workplace.id)
    .maybeSingle()
  if (!emp) return { ok: false, error: 'העובד לא נמצא.' }

  const { error: upErr } = await supabase
    .from('day_notes')
    .upsert(
      { period_id: periodId, employee_id: employeeId, day_of_week: dayIndex, label: parsed.data },
      { onConflict: 'period_id,employee_id,day_of_week' },
    )
  if (upErr) return { ok: false, error: GENERIC }

  // Remove any shift that employee had that day — they're on the note instead.
  await supabase
    .from('assignments')
    .delete()
    .eq('period_id', periodId)
    .eq('employee_id', employeeId)
    .eq('day_of_week', dayIndex)

  revalidatePath('/schedule')
  return { ok: true }
}

/** Remove a day note (the employee can be scheduled normally again). */
export async function removeDayNote(
  periodId: string,
  employeeId: string,
  dayIndex: number,
): Promise<DayNoteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: 'לא נמצא מקום עבודה.' }

  const { error } = await supabase
    .from('day_notes')
    .delete()
    .eq('period_id', periodId)
    .eq('employee_id', employeeId)
    .eq('day_of_week', dayIndex)
  if (error) return { ok: false, error: GENERIC }

  revalidatePath('/schedule')
  return { ok: true }
}
