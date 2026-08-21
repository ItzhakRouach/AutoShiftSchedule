// Regression tests for the dashboard period selection: a newer collecting/locked
// row must never shadow the published week (the "all KPIs suddenly 0 after
// publish" incident), anchors pin the exact period, and month ranges are
// bounded on BOTH ends.
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchDashboardStats } from './fetch'

type Row = Record<string, unknown>

/** Chainable + thenable Supabase stub covering every call shape fetchDashboardStats
 *  uses: .select().eq().gte().lt().in().order().limit(), awaited directly or via
 *  .maybeSingle(). Filters only on fields the fixture rows actually carry. */
function fakeDb(tables: Record<string, Row[]>): SupabaseClient {
  function makeChain(cur: Row[]) {
    const has = (field: string) => cur.length > 0 && field in cur[0]
    return {
      select: () => makeChain(cur),
      eq: (field: string, value: unknown) =>
        makeChain(has(field) ? cur.filter((r) => r[field] === value) : cur),
      gte: (field: string, value: string) =>
        makeChain(cur.filter((r) => (r[field] as string) >= value)),
      lt: (field: string, value: string) =>
        makeChain(cur.filter((r) => (r[field] as string) < value)),
      in: (field: string, values: unknown[]) =>
        makeChain(cur.filter((r) => values.includes(r[field]))),
      order: (field: string, opts?: { ascending?: boolean }) => {
        const dir = opts?.ascending === false ? -1 : 1
        return makeChain([...cur].sort((a, b) => {
          const av = a[field] as string, bv = b[field] as string
          return av < bv ? -dir : av > bv ? dir : 0
        }))
      },
      limit: (n: number) => makeChain(cur.slice(0, n)),
      maybeSingle: async () => ({ data: cur[0] ?? null }),
      then<T>(resolve: (v: { data: Row[] }) => T) { return Promise.resolve({ data: cur }).then(resolve) },
    }
  }
  return { from: (table: string) => makeChain(tables[table] ?? []) } as unknown as SupabaseClient
}

const BASE = {
  employees: [
    { id: 'e1', name: 'אבי', color: '#111', min_shifts_per_week: 0 },
    { id: 'e2', name: 'בני', color: '#222', min_shifts_per_week: 0 },
  ],
  shift_types: [{ id: 's1', key: 'morning', hours: 8, is_fallback: false }],
  shift_requirements: [{ count: 5 }],
  requests: [],
}

const assign = (period_id: string, employee_id = 'e1') =>
  ({ employee_id, day_of_week: 0, shift_type_id: 's1', role_id: 'r1', period_id })

describe('fetchDashboardStats — week scope period selection', () => {
  it('a newer collecting period does NOT shadow the published week (the KPI-zeroing bug)', async () => {
    const db = fakeDb({
      ...BASE,
      schedule_periods: [
        { id: 'p-pub', week_start_date: '2026-08-16', status: 'published' },
        { id: 'p-col', week_start_date: '2026-08-23', status: 'collecting' },
      ],
      assignments: [assign('p-pub'), assign('p-pub', 'e2'), assign('p-col')],
    })
    const stats = await fetchDashboardStats(db, 'wp1', 'week')
    expect(stats?.kpis.filledSlots).toBe(2)
  })

  it('an anchored week pins that exact published period', async () => {
    const db = fakeDb({
      ...BASE,
      schedule_periods: [
        { id: 'p-old', week_start_date: '2026-08-09', status: 'published' },
        { id: 'p-new', week_start_date: '2026-08-16', status: 'published' },
      ],
      assignments: [assign('p-old'), assign('p-new'), assign('p-new', 'e2')],
    })
    const stats = await fetchDashboardStats(db, 'wp1', 'week', '2026-08-09')
    expect(stats?.kpis.filledSlots).toBe(1)
  })

  it('an anchor pointing at a non-published week yields the empty state', async () => {
    const db = fakeDb({
      ...BASE,
      schedule_periods: [{ id: 'p-col', week_start_date: '2026-08-23', status: 'collecting' }],
      assignments: [assign('p-col')],
    })
    const stats = await fetchDashboardStats(db, 'wp1', 'week', '2026-08-23')
    expect(stats?.kpis.filledSlots).toBe(0)
    expect(stats?.kpis.activeEmployees).toBe(2)
  })
})

describe('fetchDashboardStats — month scope range bounds', () => {
  it('an anchored month excludes published weeks of the following month', async () => {
    const db = fakeDb({
      ...BASE,
      schedule_periods: [
        { id: 'p-aug', week_start_date: '2026-08-16', status: 'published' },
        { id: 'p-sep', week_start_date: '2026-09-06', status: 'published' },
      ],
      assignments: [assign('p-aug'), assign('p-aug', 'e2'), assign('p-sep')],
    })
    const stats = await fetchDashboardStats(db, 'wp1', 'month', '2026-08-01')
    expect(stats?.trends).toHaveLength(1)
    expect(stats?.kpis.filledSlots).toBe(2)
  })
})
