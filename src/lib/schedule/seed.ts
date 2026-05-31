// Pure deterministic helpers for the schedule adapter (no IO).

/** Deterministic uint32 seed from a uuid string (FNV-1a). */
export function seedFromUuid(uuid: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < uuid.length; i++) {
    h ^= uuid.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Compute the 7 ISO dates for a week starting at `weekStartISO` (YYYY-MM-DD). */
export function weekDatesFrom(weekStartISO: string): string[] {
  const [y, m, d] = weekStartISO.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(base)
    dt.setUTCDate(base.getUTCDate() + i)
    const yyyy = dt.getUTCFullYear()
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(dt.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  })
}
