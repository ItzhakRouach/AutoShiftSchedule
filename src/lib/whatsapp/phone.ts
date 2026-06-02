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
