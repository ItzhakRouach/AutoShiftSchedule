/**
 * Israeli phone-number normalization for WhatsApp.
 * Pure (no I/O) so it can run on the server, in actions, and in tests.
 *
 * Output format: E.164 without the leading '+', e.g. 0521234567 → 972521234567.
 * Returns null for anything that cannot be a valid Israeli number.
 */

/** Normalize a raw Israeli phone string to `972XXXXXXXX`, or null if invalid. */
export function normalizeIsraeliPhone(raw: string | null | undefined): string | null {
  if (!raw) return null

  let digits = raw.replace(/\D/g, '')
  if (!digits) return null

  // Strip a country code if present (handles +972, 972, and 972 0...).
  if (digits.startsWith('972')) {
    digits = digits.slice(3)
    if (digits.startsWith('0')) digits = digits.slice(1)
  } else if (digits.startsWith('0')) {
    // Local format: drop the trunk '0'.
    digits = digits.slice(1)
  }

  // Israeli subscriber numbers (without trunk 0) are 8 (landline) or 9 (mobile) digits.
  if (digits.length < 8 || digits.length > 9) return null

  return `972${digits}`
}

/** True when the raw string normalizes to a valid Israeli phone number. */
export function isValidIsraeliPhone(raw: string | null | undefined): boolean {
  return normalizeIsraeliPhone(raw) !== null
}

// ── Local (trunk-0) format — how phones are stored and displayed ─────────────
// wa.me still needs E.164 (normalizeIsraeliPhone); these produce/consume the
// local `0XXXXXXXXX` form the app stores and shows.

/** Common Israeli mobile prefixes (each a 3-digit `05X`), for the input dropdown. */
export const ISRAELI_MOBILE_PREFIXES = ['050', '052', '053', '054', '055', '058', '051'] as const

/** Normalize any accepted input to the local form `0504551558`, or null if invalid. */
export function toLocalIsraeliPhone(raw: string | null | undefined): string | null {
  const e164 = normalizeIsraeliPhone(raw)
  return e164 ? `0${e164.slice(3)}` : null
}

/**
 * Format a phone for display as local dashed text, e.g. `050-455-1558`
 * (dash after the prefix and after the first 3 digits). A 10-digit mobile is
 * grouped 3-3-4; other valid lengths return the plain local number; anything
 * unparseable returns the raw string; empty/nullish returns ''.
 */
export function formatIsraeliPhoneLocal(raw: string | null | undefined): string {
  if (!raw) return ''
  const local = toLocalIsraeliPhone(raw)
  if (!local) return raw
  if (local.length === 10) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`
  return local
}

/** Split a phone into a 3-digit local prefix + the rest, for pre-filling the
 *  dropdown+number input. Returns empty parts when the input can't be parsed. */
export function splitLocalPhone(raw: string | null | undefined): { prefix: string; rest: string } {
  const local = toLocalIsraeliPhone(raw)
  if (!local) return { prefix: '', rest: '' }
  return { prefix: local.slice(0, 3), rest: local.slice(3) }
}
