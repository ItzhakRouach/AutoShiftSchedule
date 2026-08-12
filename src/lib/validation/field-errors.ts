import type { ZodError } from 'zod'

/** First Zod issue message per top-level field ('form' for path-less issues). */
export function buildFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
