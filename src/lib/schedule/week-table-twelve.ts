/**
 * 12h fill-plan resolution for the week table — anchor + coverage rules.
 * Pure — no IO, no Supabase. Split out of week-table-data.ts to honor the
 * project's ≤200-line rule.
 *
 * Two regimes, selected per-row by whether `t.fills` is present:
 *  - FILLS-BEARING (Task 1 wrote a real `twelve_fills` plan): the anchor and
 *    covered cells come STRICTLY from that array — each fill under its OWN
 *    role. Cross-role plans render correctly and two 12h shifts on the same
 *    day never stack into one cell (the screenshot bug). No physical
 *    TWELVE_HOUR_COVERS marking is added — a manual m12_night with a single
 *    `fills: [night]` entry does NOT claim noon as covered.
 *  - LEGACY (fills undefined/null — pre-Task-1 rows or malformed jsonb): byte
 *    identical to the pre-existing heuristic — synthesize fills from
 *    TWELVE_HOUR_FILLS[variant] all under the row's single `roleId`, AND keep
 *    the physical TWELVE_HOUR_COVERS-minus-anchor marking.
 */
import type { ScheduleView, ViewTwelve, ViewTwelveFill } from './view-data'
import { TWELVE_HOUR_COVERS, TWELVE_HOUR_FILLS } from '@/lib/scheduling/fallback'
import type { TwelveHourKey } from '@/lib/scheduling/types'

/** Is a base (non-12h) person already assigned to this (day, shift, role)? */
function baseOccupied(view: ScheduleView, day: number, shift: string, roleId: string): boolean {
  return (view.grid[day]?.[shift]?.[roleId] ?? []).length > 0
}

/**
 * The fill plan to use for a 12h row: the real persisted plan when present,
 * else a legacy synthesis (every TWELVE_HOUR_FILLS window under the row's
 * single `roleId` — this is exactly what the pre-Task-1 view assumed).
 */
export function twelveFillsOf(t: ViewTwelve): ViewTwelveFill[] {
  if (t.fills && t.fills.length > 0) return t.fills
  const legacy = TWELVE_HOUR_FILLS[t.variant as TwelveHourKey]
  if (!legacy) return []
  return legacy.map((shift) => ({ shift, roleId: t.roleId }))
}

/**
 * The base windows a 12h row PHYSICALLY COVERS (the worker is on duty then) —
 * for "requested" matching: an m12_night satisfies a noon OR night request even
 * though it only FILLS night. Falls back to the fill plan for unknown variants.
 */
export function twelveCoversOf(t: ViewTwelve): string[] {
  const covers = TWELVE_HOUR_COVERS[t.variant as TwelveHourKey]
  if (covers) return [...covers]
  return twelveFillsOf(t).map((f) => f.shift)
}

/**
 * Which fill shows the 12h person's NAME: the first fill whose (day, shift,
 * fill.roleId) cell has no BASE occupant — i.e. the actual gap it's covering.
 * Falls back to fills[0] when every fill's cell is base-occupied (or there's
 * only one fill). Operates on the resolved fill list (real or legacy-
 * synthesized) so cross-role plans anchor under the CORRECT role per fill.
 */
export function twelveAnchor(view: ScheduleView, t: ViewTwelve): ViewTwelveFill | undefined {
  const fills = twelveFillsOf(t)
  if (fills.length === 0) return undefined
  return fills.find((f) => !baseOccupied(view, t.day, f.shift, f.roleId)) ?? fills[0]
}

/**
 * Cells visually marked as covered by a 12h shift. Keys: `${day}:${shift}:${roleId}`.
 * Value = how many 12h shifts cover that cell (fixes the "2/1" stacking bug —
 * `assignedCount = cellEntries.length + coveredCount`, XOR with the anchor so
 * nothing is double counted).
 *
 * FILLS-BEARING rows: covered = fills minus the anchor, each under its OWN
 * role, skipping any fill whose cell is base-occupied (don't overwrite a real
 * name with a "12ש׳" chip). Strict — no physical-overlap guessing.
 *
 * LEGACY rows (no fills): ADDITIONALLY keep today's physical heuristic —
 * every shift TWELVE_HOUR_COVERS[variant] touches, minus the anchor, under
 * the row's single roleId, skipping base-occupied cells. Byte-identical to
 * the pre-Task-1 behavior.
 */
export function coveredByTwelve(view: ScheduleView): Map<string, number> {
  const covered = new Map<string, number>()
  const bump = (key: string) => covered.set(key, (covered.get(key) ?? 0) + 1)

  for (const t of view.twelve) {
    const anchor = twelveAnchor(view, t)
    const isLegacy = !t.fills || t.fills.length === 0

    if (isLegacy) {
      const physical = TWELVE_HOUR_COVERS[t.variant as TwelveHourKey]
      if (!physical || physical.length === 0) continue
      for (const baseShift of physical) {
        if (anchor && baseShift === anchor.shift && t.roleId === anchor.roleId) continue
        if (baseOccupied(view, t.day, baseShift, t.roleId)) continue
        bump(`${t.day}:${baseShift}:${t.roleId}`)
      }
      continue
    }

    // Fills-bearing: strict — only the persisted fills, each under its own role.
    const fills = twelveFillsOf(t)
    for (const f of fills) {
      if (anchor && f.shift === anchor.shift && f.roleId === anchor.roleId) continue
      if (baseOccupied(view, t.day, f.shift, f.roleId)) continue
      bump(`${t.day}:${f.shift}:${f.roleId}`)
    }
  }
  return covered
}
