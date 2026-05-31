// 12h fallback proposals. When the 8h grid can't be fully staffed within hard
// constraints AND allow12hFallback, propose 12h variants only where needed.
// These are SUGGESTIONS flagged for manager approval — never auto-assigned.
import type {
  Settings,
  ShiftKey,
  TwelveHourKey,
  TwelveHourSuggestion,
  Warning,
} from './types'

/**
 * Map a 12h variant to the pair of adjacent 8h base shifts it covers.
 * 07–19 day covers morning(07–15)+noon(15–23 partial→noon). 19–07 covers
 * noon+night region into next morning. We map by the base shifts whose gaps a
 * variant best plugs.
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

/**
 * Build 12h suggestions from the residual warnings (unfilled slots). Returns []
 * unless allow12hFallback is enabled. Deduplicates per (day, variant, role).
 */
export function buildTwelveHourSuggestions(
  warnings: Warning[],
  settings: Settings,
): TwelveHourSuggestion[] {
  if (!settings.allow12hFallback) return []
  const seen = new Set<string>()
  const out: TwelveHourSuggestion[] = []
  for (const w of warnings) {
    const variant = variantForShift(w.shift)
    const key = `${w.day}:${variant}:${w.roleId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      day: w.day,
      variant,
      roleId: w.roleId,
      covers: TWELVE_HOUR_COVERS[variant],
      reason: `Uncovered ${w.shift} slot for role ${w.roleId}; suggest 12h ${variant} (needs approval).`,
    })
  }
  return out
}
