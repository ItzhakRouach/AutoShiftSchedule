import type { ScheduleView } from '@/lib/schedule/view-data'

export interface MyRoleCount {
  roleId: string
  name: string
  color: string
  count: number
}

/**
 * Counts how many shifts the given employee holds in each role within a
 * published schedule view — including 12h shifts. Pure (no IO) so it's unit
 * tested and can be derived straight from the view the page already loaded.
 * Returns roles in the view's existing order, omitting roles with zero shifts.
 */
export function countMyRoles(
  view: ScheduleView,
  employeeId: string,
): { roles: MyRoleCount[]; total: number } {
  const counts = new Map<string, number>()

  for (const day of Object.values(view.grid)) {
    for (const byRole of Object.values(day)) {
      for (const [roleId, empIds] of Object.entries(byRole)) {
        const n = empIds.filter((id) => id === employeeId).length
        if (n) counts.set(roleId, (counts.get(roleId) ?? 0) + n)
      }
    }
  }

  for (const t of view.twelve) {
    if (t.employeeId === employeeId) {
      counts.set(t.roleId, (counts.get(t.roleId) ?? 0) + 1)
    }
  }

  const roles: MyRoleCount[] = view.roles
    .filter((r) => (counts.get(r.id) ?? 0) > 0)
    .map((r) => ({ roleId: r.id, name: r.name, color: r.color ?? 'var(--accent)', count: counts.get(r.id) ?? 0 }))
  const total = roles.reduce((sum, r) => sum + r.count, 0)
  return { roles, total }
}
