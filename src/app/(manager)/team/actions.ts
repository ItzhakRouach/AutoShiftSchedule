'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { employeeSchema } from '@/lib/validation/employee'
import { parseFormData, buildFieldErrors } from '@/lib/employees/form'
import { syncEmployeeRoles } from '@/lib/employees/roles'

// A small color palette for auto-assigning employee avatar colors
const EMPLOYEE_COLORS = [
  '#3D6BF5',
  '#13A98E',
  '#E0902A',
  '#EB6A4E',
  '#5B61D6',
  '#B05AB5',
  '#2E9E6B',
  '#D94F6A',
]

function pickColor(index: number): string {
  return EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length]
}

export type EmployeeActionState = {
  ok?: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

// ── createEmployee ────────────────────────────────────────────────────────────

export async function createEmployee(
  prevState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה. אנא עברו להכשרה.' }

  const raw = parseFormData(formData)
  const parsed = employeeSchema.safeParse(raw)
  if (!parsed.success) return { fieldErrors: buildFieldErrors(parsed) }

  const { name, phone, minShifts, observesShabbat, observesHolidays, mustAccept, roleIds } =
    parsed.data

  const { count } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('workplace_id', workplace.id)

  const { data: emp, error: empError } = await supabase
    .from('employees')
    .insert({
      workplace_id: workplace.id,
      name,
      phone: phone || null,
      color: pickColor(count ?? 0),
      min_shifts_per_week: minShifts,
      observes_shabbat: observesShabbat,
      observes_holidays: observesHolidays,
      must_accept: mustAccept,
      status: 'pending',
    })
    .select('id')
    .single()

  if (empError || !emp) {
    return { error: 'שגיאה ביצירת עובד: ' + (empError?.message ?? 'שגיאה לא ידועה') }
  }

  const { error: rolesError } = await supabase
    .from('employee_roles')
    .insert(roleIds.map((roleId) => ({ employee_id: emp.id, role_id: roleId })))

  if (rolesError) {
    await supabase.from('employees').delete().eq('id', emp.id)
    return { error: 'שגיאה בשיוך תפקידים לעובד' }
  }

  revalidatePath('/team')
  return { ok: true }
}

// ── updateEmployee ────────────────────────────────────────────────────────────

export async function updateEmployee(
  id: string,
  prevState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { error: 'לא נמצא מקום עבודה.' }

  const { data: existing } = await supabase
    .from('employees')
    .select('id')
    .eq('id', id)
    .eq('workplace_id', workplace.id)
    .maybeSingle()

  if (!existing) return { error: 'עובד לא נמצא.' }

  const raw = parseFormData(formData)
  const parsed = employeeSchema.safeParse(raw)
  if (!parsed.success) return { fieldErrors: buildFieldErrors(parsed) }

  const { name, phone, minShifts, observesShabbat, observesHolidays, mustAccept, roleIds } =
    parsed.data

  const { error: updateError } = await supabase
    .from('employees')
    .update({
      name,
      phone: phone || null,
      min_shifts_per_week: minShifts,
      observes_shabbat: observesShabbat,
      observes_holidays: observesHolidays,
      must_accept: mustAccept,
    })
    .eq('id', id)

  if (updateError) return { error: 'שגיאה בעדכון עובד: ' + updateError.message }

  const syncError = await syncEmployeeRoles(supabase, id, roleIds)
  if (syncError) return { error: syncError }

  revalidatePath('/team')
  return { ok: true }
}

// ── deleteEmployee ────────────────────────────────────────────────────────────

export async function deleteEmployee(id: string): Promise<EmployeeActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) return { error: 'שגיאה במחיקת עובד: ' + error.message }

  revalidatePath('/team')
  return { ok: true }
}
