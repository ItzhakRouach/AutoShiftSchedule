import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type VacationStatus = 'pending' | 'approved' | 'rejected'

export interface WorkplaceVacation {
  id: string
  employeeId: string
  employeeName: string
  dateFrom: string
  dateTo: string
  status: VacationStatus
}

const STATUS_ORDER: Record<VacationStatus, number> = { pending: 0, approved: 1, rejected: 2 }

/**
 * Current & upcoming vacation requests for a workplace (any status), so the
 * manager can review pending ones AND re-edit earlier decisions. Past vacations
 * (date_to before today) are omitted to keep the list relevant. Uses an
 * elevated client because vacation rows are RLS-scoped to their employee; the
 * caller MUST pass the manager's OWN workplace id (via getActiveWorkplace).
 */
export async function getWorkplaceVacations(
  admin: SupabaseClient,
  workplaceId: string,
  todayISO: string,
): Promise<WorkplaceVacation[]> {
  const { data: emps } = await admin
    .from('employees')
    .select('id, name')
    .eq('workplace_id', workplaceId)
  const nameById = new Map((emps ?? []).map((e) => [e.id as string, (e.name as string).trim()]))
  const ids = [...nameById.keys()]
  if (ids.length === 0) return []

  const { data: vacs } = await admin
    .from('employee_vacations')
    .select('id, employee_id, date_from, date_to, status')
    .in('employee_id', ids)
    .gte('date_to', todayISO)

  return (vacs ?? [])
    .map((v) => ({
      id: v.id as string,
      employeeId: v.employee_id as string,
      employeeName: nameById.get(v.employee_id as string) ?? '—',
      dateFrom: v.date_from as string,
      dateTo: v.date_to as string,
      status: (v.status as VacationStatus) ?? 'pending',
    }))
    // Pending first (need action), then by start date.
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.dateFrom.localeCompare(b.dateFrom))
}
