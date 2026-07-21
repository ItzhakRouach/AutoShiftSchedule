'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { addVacationSchema } from '@/lib/validation/request'
import { resolveEmployee, type ActionResult } from './request-helpers'

export async function addVacation(input: unknown): Promise<ActionResult> {
  const parsed = addVacationSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? 'נתונים לא תקינים' }
  }
  const { employeeId, dateFrom, dateTo, kind } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }

  const employee = await resolveEmployee(supabase, user.id)
  if (!employee || employee.id !== employeeId) return { error: 'אין הרשאה' }

  // Block overlapping vacation ranges — a pending OR already-approved range on
  // the same day would double-book the employee's time off. Inclusive bounds:
  // Postgres' date comparisons here mirror rangesOverlap's semantics.
  const { data: overlapping } = await supabase
    .from('employee_vacations')
    .select('id')
    .eq('employee_id', employeeId)
    .lte('date_from', dateTo)
    .gte('date_to', dateFrom)
    .in('status', ['pending', 'approved'])
    .limit(1)
  if (overlapping && overlapping.length > 0) {
    return { error: 'טווח החופשה חופף לחופשה קיימת' }
  }

  const { error } = await supabase.from('employee_vacations').insert({
    employee_id: employeeId,
    date_from: dateFrom,
    date_to: dateTo,
    kind,
    // Regular vacation awaits manager approval; מילואים is auto-approved by
    // product decision (official duty — blocks scheduling immediately, and
    // the manager sees the מילואים tag).
    status: kind === 'miluim' ? 'approved' : 'pending',
  })

  if (error) return { error: 'שגיאה בהוספת חופשה' }

  revalidatePath('/me/requests')
  return { ok: true }
}

export async function removeVacation(id: string): Promise<ActionResult> {
  if (!id) return { error: 'מזהה חופשה חסר' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'אין הרשאה' }
  const employee = await resolveEmployee(supabase, user.id)
  if (!employee) return { error: 'אין הרשאה' }

  // Scope to the caller's own vacations (defense-in-depth beyond RLS).
  const { data, error } = await supabase
    .from('employee_vacations')
    .delete()
    .eq('id', id)
    .eq('employee_id', employee.id)
    .select('id')

  if (error || !data || data.length === 0) {
    return { error: 'שגיאה במחיקת חופשה' }
  }

  revalidatePath('/me/requests')
  return { ok: true }
}
