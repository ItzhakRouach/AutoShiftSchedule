// Adapter unit: computePriorDeficit reads the most-recent PUBLISHED prior period
// and computes max(0, minShifts − shiftsThen) per employee; 0 when none exists.
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computePriorDeficit } from './build-input'

type AsgRow = { employee_id: string; day_of_week: number }

/**
 * Minimal chainable Supabase stub. The period query resolves via maybeSingle()
 * to `prior`; the assignments query (terminated by .eq) resolves to `asg`.
 */
function fakeDb(prior: { id: string } | null, asg: AsgRow[]): SupabaseClient {
  const periodChain = {
    select: () => periodChain,
    eq: () => periodChain,
    lt: () => periodChain,
    order: () => periodChain,
    limit: () => periodChain,
    maybeSingle: async () => ({ data: prior }),
  }
  // assignments: .select().eq() must itself be awaitable.
  const asgEq = { then: (r: (v: { data: AsgRow[] }) => unknown) => r({ data: asg }) }
  const asgChain = { select: () => ({ eq: () => asgEq }) }
  return {
    from: (table: string) => (table === 'assignments' ? asgChain : periodChain),
  } as unknown as SupabaseClient
}

const EMPS = [
  { id: 'e1', min_shifts_per_week: 5 },
  { id: 'e2', min_shifts_per_week: 3 },
  { id: 'e3', min_shifts_per_week: 2 },
]

describe('computePriorDeficit', () => {
  it('computes max(0, min − shiftsThen) from prior published assignments', async () => {
    // e1 worked 2 days (deficit 3), e2 worked 3 days (deficit 0),
    // e3 worked 0 days (deficit 2).
    const asg: AsgRow[] = [
      { employee_id: 'e1', day_of_week: 0 },
      { employee_id: 'e1', day_of_week: 1 },
      { employee_id: 'e2', day_of_week: 0 },
      { employee_id: 'e2', day_of_week: 2 },
      { employee_id: 'e2', day_of_week: 4 },
    ]
    const d = await computePriorDeficit(fakeDb({ id: 'p0' }, asg), 'wp', '2026-06-07', EMPS)
    expect(d).toEqual({ e1: 3, e2: 0, e3: 2 })
  })

  it('counts a duplicated (employee,day) pair once (12h = one shift/day)', async () => {
    const asg: AsgRow[] = [
      { employee_id: 'e1', day_of_week: 0 },
      { employee_id: 'e1', day_of_week: 0 }, // duplicate — must not double-count
    ]
    const d = await computePriorDeficit(fakeDb({ id: 'p0' }, asg), 'wp', '2026-06-07', [
      { id: 'e1', min_shifts_per_week: 3 },
    ])
    expect(d).toEqual({ e1: 2 })
  })

  it('returns {} when there is no prior published period', async () => {
    const d = await computePriorDeficit(fakeDb(null, []), 'wp', '2026-06-07', EMPS)
    expect(d).toEqual({})
  })
})
