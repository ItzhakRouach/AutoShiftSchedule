import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type VacationStatus = 'pending' | 'approved' | 'rejected'
export type VacationKind = 'vacation' | 'miluim'

export interface WorkplaceVacation {
  id: string
  employeeId: string
  employeeName: string
  dateFrom: string
  dateTo: string
  status: VacationStatus
  kind: VacationKind
}

const STATUS_ORDER: Record<VacationStatus, number> = { pending: 0, approved: 1, rejected: 2 }

/**
 * Current & upcoming vacation requests for a workplace (any status), so the
 * manager can review pending ones AND re-edit earlier decisions. Past vacations
 * (date_to before today) are omitted to keep the list relevant. Accepts either
 * the regular authed client (vacations_manager_write / owns_employee now lets
 * a manager SELECT their own employees' vacation rows directly) or the admin
 * client (pre-existing dashboard call site) — the caller MUST pass the
 * manager's OWN workplace id (via getActiveWorkplace) either way.
 */
export async function getWorkplaceVacations(
  client: SupabaseClient,
  workplaceId: string,
  todayISO: string,
): Promise<WorkplaceVacation[]> {
  const { data: emps } = await client
    .from('employees')
    .select('id, name')
    .eq('workplace_id', workplaceId)
  const nameById = new Map((emps ?? []).map((e) => [e.id as string, (e.name as string).trim()]))
  const ids = [...nameById.keys()]
  if (ids.length === 0) return []

  const { data: vacs } = await client
    .from('employee_vacations')
    .select('id, employee_id, date_from, date_to, status, kind')
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
      kind: (v.kind as VacationKind) ?? 'vacation',
    }))
    // Pending first (need action), then by start date.
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.dateFrom.localeCompare(b.dateFrom))
}
