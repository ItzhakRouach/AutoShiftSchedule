// Shared palette for auto-assigning employee avatar colors.
export const EMPLOYEE_COLORS = [
  '#3D6BF5',
  '#13A98E',
  '#E0902A',
  '#EB6A4E',
  '#5B61D6',
  '#B05AB5',
  '#2E9E6B',
  '#D94F6A',
]

/** Deterministic pick by index (used when seeding from a known count). */
export function pickColorByIndex(index: number): string {
  return EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length]
}

/** Random pick (used when no stable index is available). */
export function pickRandomColor(): string {
  return EMPLOYEE_COLORS[Math.floor(Math.random() * EMPLOYEE_COLORS.length)]
}
