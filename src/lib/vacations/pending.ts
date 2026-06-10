import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PendingVacation {
  id: string
  employeeId: string
  employeeName: string
  dateFrom: string
  dateTo: string
}

/**
 * Pending (awaiting-approval) vacation requests for a workplace. Uses an
 * elevated client because vacation rows are RLS-scoped to their employee; the
 * caller MUST pass the manager's OWN workplace id (resolved via
 * getActiveWorkplace) so this only ever reads that workplace's requests.
 */
export async function getPendingVacations(
  admin: SupabaseClient,
  workplaceId: string,
): Promise<PendingVacation[]> {
  const { data: emps } = await admin
    .from('employees')
    .select('id, name')
    .eq('workplace_id', workplaceId)
  const nameById = new Map((emps ?? []).map((e) => [e.id as string, (e.name as string).trim()]))
  const ids = [...nameById.keys()]
  if (ids.length === 0) return []

  const { data: vacs } = await admin
    .from('employee_vacations')
    .select('id, employee_id, date_from, date_to')
    .eq('status', 'pending')
    .in('employee_id', ids)
    .order('date_from', { ascending: true })

  return (vacs ?? []).map((v) => ({
    id: v.id as string,
    employeeId: v.employee_id as string,
    employeeName: nameById.get(v.employee_id as string) ?? '—',
    dateFrom: v.date_from as string,
    dateTo: v.date_to as string,
  }))
}
