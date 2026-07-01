// Adapter unit: findAdjacentPeriod locates the week immediately before/after
// `weekStart` REGARDLESS of status (rest-tail protection must not vanish just
// because the manager hasn't published yet). findPriorPublishedPeriod keeps
// its status filter — fairness carry-over must count only published reality.
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { findAdjacentPeriod, findPriorPublishedPeriod } from './prior-period'

type PeriodRow = { id: string; week_start_date: string; status: string }

/**
 * Chainable Supabase stub for schedule_periods queries. Mimics both call
 * shapes used by the two functions:
 *  - findAdjacentPeriod: .select().eq(workplace).eq(week_start_date).maybeSingle()
 *  - findPriorPublishedPeriod: .select().eq(workplace).eq(status).lt().order().limit().maybeSingle()
 */
function fakeDb(rows: PeriodRow[]): SupabaseClient {
  // Build a chain object that carries its OWN mutable `cur` rows array, so
  // each query call gets an isolated filter pipeline (no cross-call bleed).
  function makeChain(cur: PeriodRow[], fields: string[]) {
    const project = (row: PeriodRow) => {
      const out: Record<string, string> = {}
      for (const f of fields) out[f] = (row as unknown as Record<string, string>)[f]
      return out
    }
    return {
      eq(field: string, value: string) {
        // The stub's fixture rows don't carry workplace_id — only filter on
        // fields actually present on the row shape (status / week_start_date).
        const next = field === 'status' || field === 'week_start_date'
          ? cur.filter((r) => (r as unknown as Record<string, string>)[field] === value)
          : cur
        return makeChain(next, fields)
      },
      lt(field: string, value: string) {
        const next = cur.filter((r) => (r as unknown as Record<string, string>)[field] < value)
        return makeChain(next, fields)
      },
      order(field: string, opts: { ascending: boolean }) {
        const dir = opts.ascending ? 1 : -1
        const next = [...cur].sort((a, b) => {
          const av = (a as unknown as Record<string, string>)[field]
          const bv = (b as unknown as Record<string, string>)[field]
          return av < bv ? -dir : av > bv ? dir : 0
        })
        return makeChain(next, fields)
      },
      limit(n: number) {
        return makeChain(cur.slice(0, n), fields)
      },
      maybeSingle: async () => ({ data: cur[0] ? project(cur[0]) : null }),
    }
  }
  return {
    from: () => ({
      select: (cols: string) => makeChain(rows, cols.split(',').map((c) => c.trim())),
    }),
  } as unknown as SupabaseClient
}

describe('findAdjacentPeriod', () => {
  it('returns the adjacent (-7d) row when it is COLLECTING', async () => {
    const db = fakeDb([{ id: 'p0', week_start_date: '2026-05-31', status: 'collecting' }])
    const r = await findAdjacentPeriod(db, 'wp1', '2026-06-07', -7)
    expect(r).toEqual({ id: 'p0', week_start_date: '2026-05-31' })
  })

  it('returns the adjacent (-7d) row when it is LOCKED', async () => {
    const db = fakeDb([{ id: 'p0', week_start_date: '2026-05-31', status: 'locked' }])
    const r = await findAdjacentPeriod(db, 'wp1', '2026-06-07', -7)
    expect(r).toEqual({ id: 'p0', week_start_date: '2026-05-31' })
  })

  it('returns the adjacent (-7d) row when it is PUBLISHED', async () => {
    const db = fakeDb([{ id: 'p0', week_start_date: '2026-05-31', status: 'published' }])
    const r = await findAdjacentPeriod(db, 'wp1', '2026-06-07', -7)
    expect(r).toEqual({ id: 'p0', week_start_date: '2026-05-31' })
  })

  it('returns the adjacent (+7d) row regardless of status', async () => {
    const db = fakeDb([{ id: 'p2', week_start_date: '2026-06-14', status: 'collecting' }])
    const r = await findAdjacentPeriod(db, 'wp1', '2026-06-07', 7)
    expect(r).toEqual({ id: 'p2', week_start_date: '2026-06-14' })
  })

  it('returns null when the only period is >=14 days back (no exact match)', async () => {
    const db = fakeDb([{ id: 'p-2', week_start_date: '2026-05-24', status: 'published' }])
    const r = await findAdjacentPeriod(db, 'wp1', '2026-06-07', -7)
    expect(r).toBeNull()
  })
})

describe('findPriorPublishedPeriod', () => {
  it('skips a non-published adjacent week and falls back to an older published one', async () => {
    const db = fakeDb([
      { id: 'p0', week_start_date: '2026-05-31', status: 'collecting' },
      { id: 'p-1', week_start_date: '2026-05-24', status: 'published' },
    ])
    const r = await findPriorPublishedPeriod(db, 'wp1', '2026-06-07')
    expect(r).toEqual({ id: 'p-1', week_start_date: '2026-05-24' })
  })

  it('returns null when no prior period is published at all', async () => {
    const db = fakeDb([{ id: 'p0', week_start_date: '2026-05-31', status: 'collecting' }])
    const r = await findPriorPublishedPeriod(db, 'wp1', '2026-06-07')
    expect(r).toBeNull()
  })
})
