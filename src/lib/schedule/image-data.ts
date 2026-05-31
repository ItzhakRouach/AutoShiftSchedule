/**
 * Pure helper: shapes raw DB rows into the cell grid used by the schedule image template.
 * Kept separate so it can be unit-tested without Next.js context.
 */

export interface RawAssignment {
  day_of_week: number
  shift_type_key: string // e.g. 'morning', 'noon', 'night'
  employee_name: string
}

export interface ImageCell {
  employeeNames: string[]
  /** true when required count > assigned count */
  unfilled: boolean
}

/** Grid: day (0-6) → shiftKey → cell */
export type ImageGrid = Record<number, Record<string, ImageCell>>

export const BASE_SHIFTS = ['morning', 'noon', 'night'] as const
export const SHIFT_NAMES: Record<string, string> = {
  morning: 'בוקר',
  noon: 'צהריים',
  night: 'לילה',
}

/** Build the 7×3 grid from raw assignments. */
export function buildImageGrid(
  assignments: RawAssignment[],
  /** required[day][shiftKey] = minimum headcount (optional — for unfilled flag) */
  required?: Record<number, Record<string, number>>,
): ImageGrid {
  const grid: ImageGrid = {}

  // Initialize empty cells
  for (let d = 0; d < 7; d++) {
    grid[d] = {}
    for (const sk of BASE_SHIFTS) {
      grid[d][sk] = { employeeNames: [], unfilled: false }
    }
  }

  // Fill assignments
  for (const a of assignments) {
    const sk = a.shift_type_key
    if (!BASE_SHIFTS.includes(sk as (typeof BASE_SHIFTS)[number])) continue
    const day = a.day_of_week
    if (day < 0 || day > 6) continue
    grid[day][sk].employeeNames.push(a.employee_name)
  }

  // Mark unfilled
  if (required) {
    for (let d = 0; d < 7; d++) {
      for (const sk of BASE_SHIFTS) {
        const req = required[d]?.[sk] ?? 0
        const assigned = grid[d][sk].employeeNames.length
        grid[d][sk].unfilled = req > 0 && assigned < req
      }
    }
  }

  return grid
}
