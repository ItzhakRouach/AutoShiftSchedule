// Pure builders/parsers for `assignments.twelve_fills` — the real 12h fill
// plan persisted alongside a 12h assignment row. NO I/O (see CLAUDE.md "pure
// scheduling logic" rule). See migration 20260703000001 for the column shape.
import { TWELVE_HOUR_FILLS } from '@/lib/scheduling/fallback'
import type { ShiftKey, TwelveHourKey } from '@/lib/scheduling/types'

export interface TwelveFillEntry {
  shift: ShiftKey
  role_id: string
}

const VALID_SHIFTS: ReadonlySet<string> = new Set<ShiftKey>(['morning', 'noon', 'night'])

/**
 * Build the fill plan for an ENGINE-generated 12h assignment: walk
 * TWELVE_HOUR_FILLS[variant] in order and map each covered shift's role NAME
 * (rolesByShift) to a role_id via nameToRoleId. Entries whose role name can't
 * be resolved are dropped (never throw — a persist attempt should degrade,
 * not crash the run). Returns null when nothing resolves, so callers can treat
 * it exactly like a legacy/no-fills row.
 */
export function buildEngineTwelveFills(
  variant: TwelveHourKey,
  rolesByShift: Partial<Record<ShiftKey, string>>,
  nameToRoleId: Record<string, string>,
): TwelveFillEntry[] | null {
  const fills: TwelveFillEntry[] = []
  for (const shift of TWELVE_HOUR_FILLS[variant]) {
    const roleName = rolesByShift[shift]
    if (!roleName) continue
    const roleId = nameToRoleId[roleName]
    if (!roleId) continue
    fills.push({ shift, role_id: roleId })
  }
  return fills.length > 0 ? fills : null
}

/**
 * Build the fill plan for a MANUAL 12h assignment (edit-actions.ts
 * assignTwelveHour): every base-shift window TWELVE_HOUR_FILLS[variant]
 * covers, all under the single chosen role — there is no cross-role
 * possibility in the manual single-role flow.
 */
export function buildManualTwelveFills(
  variantKey: TwelveHourKey,
  roleId: string,
): TwelveFillEntry[] {
  return TWELVE_HOUR_FILLS[variantKey].map((shift) => ({ shift, role_id: roleId }))
}

/**
 * Defensive shape guard for a `twelve_fills` value read back from the DB
 * (jsonb → unknown at the type boundary). Any malformed shape — not an array,
 * empty array, wrong field types, unknown shift key — returns null so the
 * caller treats it exactly like a legacy row (no fills) rather than trusting
 * corrupt data.
 */
export function parseTwelveFills(raw: unknown): TwelveFillEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const fills: TwelveFillEntry[] = []
  for (const entry of raw) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof (entry as { shift?: unknown }).shift !== 'string' ||
      !VALID_SHIFTS.has((entry as { shift: string }).shift) ||
      typeof (entry as { role_id?: unknown }).role_id !== 'string' ||
      (entry as { role_id: string }).role_id.length === 0
    ) {
      return null
    }
    fills.push({
      shift: (entry as { shift: ShiftKey }).shift,
      role_id: (entry as { role_id: string }).role_id,
    })
  }
  return fills
}
