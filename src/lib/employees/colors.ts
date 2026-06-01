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
  '#C0598F',
  '#7A8B3D',
  '#2BB3C0',
  '#D08A2E',
  '#6A4EC0',
  '#4EB5A0',
  '#C0934E',
  '#8B3D6A',
  '#3D8B5B',
  '#B54E2E',
  '#4E6AC0',
  '#A0B52E',
]

/** Deterministic pick by index (used when seeding from a known count). */
export function pickColorByIndex(index: number): string {
  return EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length]
}

/** Random pick (used when no stable index is available). */
export function pickRandomColor(): string {
  return EMPLOYEE_COLORS[Math.floor(Math.random() * EMPLOYEE_COLORS.length)]
}

/**
 * Returns the first palette color not present in `existing`.
 * If all palette colors are taken, generates a unique color via evenly-spaced HSL
 * so it is always distinct from the palette and from other overflow colors.
 *
 * Pure function — no IO, fully unit-testable.
 */
export function pickUniqueColor(existing: string[]): string {
  const existingSet = new Set(existing.map((c) => c.toLowerCase()))

  for (const color of EMPLOYEE_COLORS) {
    if (!existingSet.has(color.toLowerCase())) return color
  }

  // All palette slots taken — generate a unique overflow color via the golden-angle trick.
  // Index = existing.length ensures monotonically distinct hues.
  const hue = (existing.length * 137.5) % 360
  return `hsl(${Math.round(hue)}, 65%, 50%)`
}
