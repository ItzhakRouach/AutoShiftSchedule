import { timingSafeEqual } from 'crypto'

/**
 * Constant-time string comparison for secrets (cron bearer tokens, etc.) so a
 * timing side-channel can't leak how much of the value matched. Returns false
 * on any length mismatch without a variable-time short-circuit on content.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
