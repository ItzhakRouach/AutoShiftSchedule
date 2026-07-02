'use server'

import { revalidatePath } from 'next/cache'
import { managerAddVacationSchema } from '@/lib/validation/request'
import { authedWorkplace } from './edit-actions-helpers'

type Result = { ok: true } | { error: string }

const OVERLAP_MSG = 'הטווח חופף להיעדרות קיימת'

/**
 * Manager adds (and auto-approves) a היעדרות (absence) — vacation, מילואים or
 * מחלה — for a worker in their workplace, from the schedule "בקשות עובדים"
 * view. Unlike the employee-submitted flow (pending → manager approval), a
 * manager-created absence is approved immediately since the manager IS the
 * approver.
 */
export async function addWorkerVacation(
  employeeId: string,
  dateFrom: string,
  dateTo: string,
  kind: 'vacation' | 'miluim' | 'sick' = 'vacation',
): Promise<Result> {
  const parsed = managerAddVacationSchema.safeParse({ employeeId, dateFrom, dateTo, kind })
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? 'נתונים לא תקינים' }
  }

  const { supabase, workplace, redirectLogin } = await authedWorkplace()
  if (redirectLogin) return { error: 'אין הרשאה' }
  if (!workplace) return { error: 'לא נמצא מקום עבודה' }

  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('id', parsed.data.employeeId)
    .eq('workplace_id', workplace.id)
    .maybeSingle()
  if (!emp) return { error: 'העובד לא נמצא' }

  // Overlap check mirrors the employee-side one (pending OR approved blocks) —
  // any absence range overlapping another is still an overlap: one absence
  // per period of time, regardless of kind.
  const { data: overlapping } = await supabase
    .from('employee_vacations')
    .select('id')
    .eq('employee_id', parsed.data.employeeId)
    .lte('date_from', parsed.data.dateTo)
    .gte('date_to', parsed.data.dateFrom)
    .in('status', ['pending', 'approved'])
    .limit(1)
  if (overlapping && overlapping.length > 0) return { error: OVERLAP_MSG }

  const { error } = await supabase.from('employee_vacations').insert({
    employee_id: parsed.data.employeeId,
    date_from: parsed.data.dateFrom,
    date_to: parsed.data.dateTo,
    status: 'approved', // the manager is the approver — no pending step needed
    kind: parsed.data.kind,
  })
  if (error) return { error: 'שגיאה בהוספת היעדרות' }

  revalidatePath('/schedule')
  return { ok: true }
}

/** Manager removes a worker's היעדרות (e.g. to undo a wrong entry). Scoped to
 *  the manager's active workplace via a join through employees. */
export async function removeWorkerVacation(vacationId: string): Promise<Result> {
  if (!vacationId) return { error: 'מזהה היעדרות חסר' }

  const { supabase, workplace, redirectLogin } = await authedWorkplace()
  if (redirectLogin) return { error: 'אין הרשאה' }
  if (!workplace) return { error: 'לא נמצא מקום עבודה' }

  const { data: vac } = await supabase
    .from('employee_vacations')
    .select('id, employee_id')
    .eq('id', vacationId)
    .maybeSingle()
  if (!vac) return { error: 'ההיעדרות לא נמצאה' }

  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('id', vac.employee_id)
    .eq('workplace_id', workplace.id)
    .maybeSingle()
  if (!emp) return { error: 'אין הרשאה' }

  const { error } = await supabase.from('employee_vacations').delete().eq('id', vacationId)
  if (error) return { error: 'שגיאה במחיקת היעדרות' }

  revalidatePath('/schedule')
  return { ok: true }
}
