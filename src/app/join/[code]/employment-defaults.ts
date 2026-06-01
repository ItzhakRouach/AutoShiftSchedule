export type EmploymentType = 'full' | 'part' | 'student'

export function getEmploymentDefaults(type: EmploymentType) {
  if (type === 'full') return { min_shifts_per_week: 5, max_shifts_per_week: null }
  if (type === 'part') return { min_shifts_per_week: 0, max_shifts_per_week: 4 }
  return { min_shifts_per_week: 0, max_shifts_per_week: 3 }
}
