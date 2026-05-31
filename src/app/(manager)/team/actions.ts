'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { employeeSchema } from '@/lib/validation/employee'

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

export type EmployeeActionState = {
  ok?: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

// ── helpers ─────────────────────────────────────────────────────────────────

function parseFormData(formData: FormData) {
  const name = (formData.get('name') as string | null) ?? ''
  const phone = (formData.get('phone') as string | null) ?? ''
  const minShifts = parseInt((formData.get('minShifts') as string | null) ?? '0', 10)
  const observesShabbat = formData.get('observesShabbat') === 'true'
  const observesHolidays = formData.get('observesHolidays') === 'true'
  const mustAccept = formData.get('mustAccept') === 'true'

  // roleIds can come as multiple entries OR a single comma-joined value
  const roleIdsRaw = formData.getAll('roleIds')
  const roleIds =
    roleIdsRaw.length === 1 && (roleIdsRaw[0] as string).includes(',')
      ? (roleIdsRaw[0] as string).split(',').map((s) => s.trim()).filter(Boolean)
      : (roleIdsRaw as string[]).filter(Boolean)

  return { name, phone, minShifts, observesShabbat, observesHolidays, mustAccept, roleIds }
}

function buildFieldErrors(err: ReturnType<typeof employeeSchema.safeParse>): Record<string, string> {
  if (err.success) return {}
  const out: Record<string, string> = {}
  for (const issue of err.error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

function pickColor(index: number): string {
  return EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length]
}

// ── createEmployee ────────────────────────────────────────────────────────────

export async function createEmployee(
  prevState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) {
    return { error: 'לא נמצא מקום עבודה. אנא עברו להכשרה.' }
  }

  const raw = parseFormData(formData)
  const parsed = employeeSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: buildFieldErrors(parsed) }
  }

  const { name, phone, minShifts, observesShabbat, observesHolidays, mustAccept, roleIds } =
    parsed.data

  // Count existing employees for color assignment
  const { count } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('workplace_id', workplace.id)

  const color = pickColor(count ?? 0)

  // Insert employee row
  const { data: emp, error: empError } = await supabase
    .from('employees')
    .insert({
      workplace_id: workplace.id,
      name,
      phone: phone || null,
      color,
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

  // Insert employee_roles junction rows
  const roleRows = roleIds.map((roleId) => ({ employee_id: emp.id, role_id: roleId }))
  const { error: rolesError } = await supabase.from('employee_roles').insert(roleRows)

  if (rolesError) {
    // Compensating delete
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) {
    return { error: 'לא נמצא מקום עבודה.' }
  }

  // Defensive check: confirm employee belongs to this workplace (RLS will also block, but explicit is better)
  const { data: existing } = await supabase
    .from('employees')
    .select('id')
    .eq('id', id)
    .eq('workplace_id', workplace.id)
    .maybeSingle()

  if (!existing) {
    return { error: 'עובד לא נמצא.' }
  }

  const raw = parseFormData(formData)
  const parsed = employeeSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: buildFieldErrors(parsed) }
  }

  const { name, phone, minShifts, observesShabbat, observesHolidays, mustAccept, roleIds } =
    parsed.data

  // Update employee row
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

  if (updateError) {
    return { error: 'שגיאה בעדכון עובד: ' + updateError.message }
  }

  // Sync employee_roles: fetch existing, delete removed, insert new
  const { data: currentRoles } = await supabase
    .from('employee_roles')
    .select('role_id')
    .eq('employee_id', id)

  const existingRoleIds = new Set((currentRoles ?? []).map((r: { role_id: string }) => r.role_id))
  const newRoleIds = new Set(roleIds)

  const toDelete = [...existingRoleIds].filter((rid) => !newRoleIds.has(rid))
  const toInsert = [...newRoleIds].filter((rid) => !existingRoleIds.has(rid))

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('employee_roles')
      .delete()
      .eq('employee_id', id)
      .in('role_id', toDelete)

    if (deleteError) {
      return { error: 'שגיאה בעדכון תפקידים: ' + deleteError.message }
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('employee_roles')
      .insert(toInsert.map((role_id) => ({ employee_id: id, role_id })))

    if (insertError) {
      return { error: 'שגיאה בהוספת תפקידים: ' + insertError.message }
    }
  }

  revalidatePath('/team')
  return { ok: true }
}

// ── deleteEmployee ────────────────────────────────────────────────────────────

export async function deleteEmployee(id: string): Promise<EmployeeActionState> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // RLS will scope this to the manager's workplace automatically
  const { error } = await supabase.from('employees').delete().eq('id', id)

  if (error) {
    return { error: 'שגיאה במחיקת עובד: ' + error.message }
  }

  revalidatePath('/team')
  return { ok: true }
}
