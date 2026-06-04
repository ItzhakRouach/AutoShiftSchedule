export type EmploymentType = 'full' | 'part' | 'student'

/** Per-employment-type seed values used by the invite-join flow. Kept in sync
 *  with EmployeeEditor's `defaultsForType` so manually-added and self-joined
 *  employees start with the same bounds (full → 5/6). */
export function getEmploymentDefaults(type: EmploymentType) {
  if (type === 'full') return { min_shifts_per_week: 5, max_shifts_per_week: 6 }
  if (type === 'part') return { min_shifts_per_week: 0, max_shifts_per_week: 4 }
  return { min_shifts_per_week: 0, max_shifts_per_week: 3 }
}
