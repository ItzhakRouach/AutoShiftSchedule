// 12h fallback proposals. When the 8h grid can't be fully staffed within hard
// constraints AND allow12hFallback, propose 12h variants only where needed.
// These are SUGGESTIONS flagged for manager approval — never auto-assigned.
import { SHIFT_META } from '@/lib/domain/constants'
import type {
  Assignment,
  Settings,
  ShiftKey,
  TwelveHourKey,
  TwelveHourSuggestion,
  Warning,
} from './types'
import { shiftEndAbs, shiftStartAbs } from './rest'

/**
 * Map a 12h variant to the pair of adjacent 8h base shifts it covers (INTENT,
 * FIX 6). A 12h shift occupies two adjacent 8h windows; the mapping records
 * which base-shift gaps each variant is meant to plug so a single suggestion can
 * cover both. m12_day (07–19) ≈ morning+noon; m12_night (19–07) ≈ noon+night;
 * m12_3to15 (03–15) ≈ night(into next morning)+morning; m12_15to3 (15–03) ≈
 * noon+night. Rest/coverage accounting (when approved) treats the 12h block as
 * occupying both covered windows.
 */
export const TWELVE_HOUR_COVERS: Record<TwelveHourKey, ShiftKey[]> = {
  m12_day: ['morning', 'noon'], // 07–19
  m12_night: ['noon', 'night'], // 19–07
  m12_3to15: ['night', 'morning'], // 03–15
  m12_15to3: ['noon', 'night'], // 15–03
}

/** Pick the 12h variant that covers a given uncovered base shift. */
export function variantForShift(shift: ShiftKey): TwelveHourKey {
  switch (shift) {
    case 'morning':
      return 'm12_day'
    case 'noon':
      return 'm12_15to3'
    case 'night':
      return 'm12_night'
  }
}

/** Absolute [start,end) hours a 12h variant occupies starting on `day`. */
export function twelveHourInterval(variant: TwelveHourKey, day: number): [number, number] {
  const m = SHIFT_META[variant]
  const start = day * 24 + m.start
  return [start, start + m.hours]
}

/**
 * FIX 6: would a suggested 12h variant on `day` create a rest violation (overlap
 * or < minRestHours gap) against any already-committed shift on the adjacent
 * days? Pure. Returns true if the variant should NOT be surfaced (or be flagged).
 */
export function would12hViolateRest(
  variant: TwelveHourKey,
  day: number,
  committed: Assignment[],
  minRestHours: number,
): boolean {
  const [vs, ve] = twelveHourInterval(variant, day)
  for (const a of committed) {
    if (a.day < day - 1 || a.day > day + 1) continue
    const as = shiftStartAbs(a.day, a.shift)
    const ae = shiftEndAbs(a.day, a.shift)
    const gap = vs >= ae ? vs - ae : as >= ve ? as - ve : -1
    if (gap < minRestHours) return true
  }
  return false
}

/**
 * Build 12h suggestions from the residual warnings (unfilled slots). Returns []
 * unless allow12hFallback is enabled. Deduplicates per (day, variant, role). If
 * `committed` is supplied, variants that would violate rest against an adjacent
 * committed shift are FLAGGED (`restConflict: true`, FIX 6) so the manager is
 * warned rather than silently offered a conflicting 12h.
 */
export function buildTwelveHourSuggestions(
  warnings: Warning[],
  settings: Settings,
  committed: Record<string, Assignment[]> = {},
): TwelveHourSuggestion[] {
  if (!settings.allow12hFallback) return []
  const all = Object.values(committed).flat()
  const seen = new Set<string>()
  const out: TwelveHourSuggestion[] = []
  for (const w of warnings) {
    const variant = variantForShift(w.shift)
    const key = `${w.day}:${variant}:${w.roleId}`
    if (seen.has(key)) continue
    seen.add(key)
    const restConflict = would12hViolateRest(variant, w.day, all, settings.minRestHours)
    out.push({
      day: w.day,
      variant,
      roleId: w.roleId,
      covers: TWELVE_HOUR_COVERS[variant],
      restConflict,
      reason: restConflict
        ? `Uncovered ${w.shift} slot for role ${w.roleId}; 12h ${variant} would violate rest vs an adjacent committed shift (flagged).`
        : `Uncovered ${w.shift} slot for role ${w.roleId}; suggest 12h ${variant} (needs approval).`,
    })
  }
  return out
}
