'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { employeeSchema } from '@/lib/validation/employee'
import { parseFormData, buildFieldErrors } from '@/lib/employees/form'
import { syncEmployeeRoles } from '@/lib/employees/roles'
import { syncEmployeeAvailability } from '@/lib/employees/availability'
import { workplaceOwnershipError } from '@/lib/employees/validate-ownership'
import { pickUniqueColor } from '@/lib/employees/colors'
import { toLocalIsraeliPhone } from '@/lib/whatsapp/phone'

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

  const {
    name, phone, minShifts, maxShifts, employmentType,
    observesShabbat, observesHolidays, mustAccept, roleIds, seniorRoleIds, availability,
  } = parsed.data
  const seniorSet = new Set(seniorRoleIds.filter((rid) => roleIds.includes(rid)))

  // Defense-in-depth: roles + availability shift types must be this workplace's.
  const ownErr = await workplaceOwnershipError(
    supabase, workplace.id,
    [...roleIds, ...seniorRoleIds],
    (availability ?? []).map((a) => a.shiftTypeId),
  )
  if (ownErr) return { error: ownErr }

  // Store the local number (0504551558). Reject anything that isn't a valid
  // Israeli number instead of persisting the raw string.
  const localPhone = toLocalIsraeliPhone(phone)
  if (!localPhone) return { fieldErrors: { phone: 'מספר טלפון לא תקין' } }

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
      phone: localPhone,
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
    .insert(roleIds.map((roleId) => ({ employee_id: emp.id, role_id: roleId, is_senior: seniorSet.has(roleId) })))

  if (rolesError) {
    await supabase.from('employees').delete().eq('id', emp.id)
    return { error: 'שגיאה בשיוך תפקידים לעובד' }
  }

  const availError = await syncEmployeeAvailability(supabase, emp.id, availability ?? null)
  if (availError) return { error: availError }

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

  const {
    name, phone, minShifts, maxShifts, employmentType,
    observesShabbat, observesHolidays, mustAccept, roleIds, seniorRoleIds, availability,
  } = parsed.data

  const ownErr = await workplaceOwnershipError(
    supabase, workplace.id,
    [...roleIds, ...seniorRoleIds],
    (availability ?? []).map((a) => a.shiftTypeId),
  )
  if (ownErr) return { error: ownErr }

  const localPhone = toLocalIsraeliPhone(phone)
  if (!localPhone) return { fieldErrors: { phone: 'מספר טלפון לא תקין' } }

  const { error: updateError } = await supabase
    .from('employees')
    .update({
      name,
      phone: localPhone,
      min_shifts_per_week: minShifts,
      max_shifts_per_week: maxShifts,
      employment_type: employmentType,
      observes_shabbat: observesShabbat,
      observes_holidays: observesHolidays,
      must_accept: mustAccept,
    })
    .eq('id', id)

  if (updateError) return { error: 'שגיאה בשמירת העובד' }

  const syncError = await syncEmployeeRoles(supabase, id, roleIds, seniorRoleIds)
  if (syncError) return { error: syncError }

  const availError = await syncEmployeeAvailability(supabase, id, availability ?? null)
  if (availError) return { error: availError }

  revalidatePath('/team')
  return { ok: true }
}

// deleteEmployee lives in delete-action.ts (≤200-line rule).
