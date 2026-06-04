'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { employeeSchema } from '@/lib/validation/employee'
import { parseFormData, buildFieldErrors } from '@/lib/employees/form'
import { syncEmployeeRoles } from '@/lib/employees/roles'
import { syncEmployeeAvailability } from '@/lib/employees/availability'
import { pickUniqueColor } from '@/lib/employees/colors'
import { normalizeIsraeliPhone } from '@/lib/whatsapp/phone'
import { sendInviteToPhone } from './invite-actions'

export type EmployeeActionState = {
  ok?: boolean
  error?: string
  fieldErrors?: Record<string, string>
  /** Soft warning surfaced after a successful save (e.g. WhatsApp send failed). */
  warning?: string
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

  const {
    name, phone, minShifts, maxShifts, employmentType,
    observesShabbat, observesHolidays, mustAccept, roleIds, availability,
  } = parsed.data

  const { data: existingEmps } = await supabase
    .from('employees')
    .select('color')
    .eq('workplace_id', workplace.id)

  const existingColors = (existingEmps ?? []).map((e) => e.color as string).filter(Boolean)

  const { data: emp, error: empError } = await supabase
    .from('employees')
    .insert({
      workplace_id: workplace.id,
      name,
      phone: phone ? (normalizeIsraeliPhone(phone) ?? phone) : null,
      color: pickUniqueColor(existingColors),
      min_shifts_per_week: minShifts,
      max_shifts_per_week: maxShifts,
      employment_type: employmentType,
      observes_shabbat: observesShabbat,
      observes_holidays: observesHolidays,
      must_accept: mustAccept,
      status: 'pending',
    })
    .select('id')
    .single()

  if (empError || !emp) return { error: 'שגיאה בשמירת העובד' }

  const { error: rolesError } = await supabase
    .from('employee_roles')
    .insert(roleIds.map((roleId) => ({ employee_id: emp.id, role_id: roleId })))

  if (rolesError) {
    await supabase.from('employees').delete().eq('id', emp.id)
    return { error: 'שגיאה בשיוך תפקידים לעובד' }
  }

  const availError = await syncEmployeeAvailability(supabase, emp.id, availability ?? null)
  if (availError) return { error: availError }

  // Optional WhatsApp invite — only fires when the form opted in AND a phone
  // exists. Failures never roll back the employee save (soft warning instead).
  let warning: string | undefined
  if (parsed.data.sendInvite && phone) {
    const invite = await sendInviteToPhone(phone, name)
    if (invite.warning) warning = invite.warning
    if (!invite.ok) warning = invite.error
  }

  revalidatePath('/team')
  return warning ? { ok: true, warning } : { ok: true }
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

  const {
    name, phone, minShifts, maxShifts, employmentType,
    observesShabbat, observesHolidays, mustAccept, roleIds, availability,
  } = parsed.data

  const { error: updateError } = await supabase
    .from('employees')
    .update({
      name,
      phone: phone ? (normalizeIsraeliPhone(phone) ?? phone) : null,
      min_shifts_per_week: minShifts,
      max_shifts_per_week: maxShifts,
      employment_type: employmentType,
      observes_shabbat: observesShabbat,
      observes_holidays: observesHolidays,
      must_accept: mustAccept,
    })
    .eq('id', id)

  if (updateError) return { error: 'שגיאה בשמירת העובד' }

  const syncError = await syncEmployeeRoles(supabase, id, roleIds)
  if (syncError) return { error: syncError }

  const availError = await syncEmployeeAvailability(supabase, id, availability ?? null)
  if (availError) return { error: availError }

  revalidatePath('/team')
  return { ok: true }
}

// ── deleteEmployee ────────────────────────────────────────────────────────────

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
