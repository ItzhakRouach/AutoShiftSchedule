import type { SupabaseClient } from '@supabase/supabase-js'
import type { AvailabilityItem } from '@/lib/validation/employee'

/**
 * Syncs employee_availability to match the desired list.
 * - If `desired` is null/empty, delete ALL rows for the employee (unrestricted).
 * - Otherwise upsert desired rows and delete any rows not in the new list.
 * Returns an error string on failure, null on success.
 */
export async function syncEmployeeAvailability(
  supabase: SupabaseClient,
  employeeId: string,
  desired: AvailabilityItem[] | null,
): Promise<string | null> {
  // Unrestricted: remove all rows
  if (!desired || desired.length === 0) {
    const { error } = await supabase
      .from('employee_availability')
      .delete()
      .eq('employee_id', employeeId)
    return error ? 'שגיאה בעדכון זמינות העובד' : null
  }

  // Fetch existing rows
  const { data: existing, error: fetchError } = await supabase
    .from('employee_availability')
    .select('day_of_week, shift_type_id')
    .eq('employee_id', employeeId)

  if (fetchError) return 'שגיאה בשליפת זמינות העובד'

  const toKey = (day: number, shiftId: string) => `${day}:${shiftId}`

  const existingKeys = new Set(
    (existing ?? []).map((r: { day_of_week: number; shift_type_id: string }) =>
      toKey(r.day_of_week, r.shift_type_id),
    ),
  )
  const desiredKeys = new Set(desired.map((d) => toKey(d.dayOfWeek, d.shiftTypeId)))

  const toDelete = (existing ?? []).filter(
    (r: { day_of_week: number; shift_type_id: string }) =>
      !desiredKeys.has(toKey(r.day_of_week, r.shift_type_id)),
  )
  const toInsert = desired.filter((d) => !existingKeys.has(toKey(d.dayOfWeek, d.shiftTypeId)))

  if (toDelete.length > 0) {
    for (const row of toDelete) {
      const { error } = await supabase
        .from('employee_availability')
        .delete()
        .eq('employee_id', employeeId)
        .eq('day_of_week', row.day_of_week)
        .eq('shift_type_id', row.shift_type_id)
      if (error) return 'שגיאה בעדכון זמינות העובד'
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from('employee_availability')
      .insert(
        toInsert.map((d) => ({
          employee_id: employeeId,
          day_of_week: d.dayOfWeek,
          shift_type_id: d.shiftTypeId,
        })),
      )
    if (error) return 'שגיאה בעדכון זמינות העובד'
  }

  return null
}
