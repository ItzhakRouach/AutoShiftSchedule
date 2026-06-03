// Adapter unit: computePriorDeficit reads assignments for a pre-resolved prior
// period and computes max(0, minShifts − shiftsThen) per employee; {} when no
// prior period was passed. (The prior-period lookup itself lives in
// findPriorPublishedPeriod and is tested separately.)
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computePriorDeficit } from './build-input'

type AsgRow = { employee_id: string; day_of_week: number }

/**
 * Minimal chainable Supabase stub. The assignments query
 * (.from('assignments').select().eq()) resolves to `asg`.
 */
function fakeDb(asg: AsgRow[]): SupabaseClient {
  const asgEq = { then: (r: (v: { data: AsgRow[] }) => unknown) => r({ data: asg }) }
  const asgChain = { select: () => ({ eq: () => asgEq }) }
  return {
    from: () => asgChain,
  } as unknown as SupabaseClient
}

const EMPS = [
  { id: 'e1', min_shifts_per_week: 5 },
  { id: 'e2', min_shifts_per_week: 3 },
  { id: 'e3', min_shifts_per_week: 2 },
]

const PRIOR = { id: 'p0', week_start_date: '2026-05-31' }

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
    const d = await computePriorDeficit(fakeDb(asg), PRIOR, EMPS)
    expect(d).toEqual({ e1: 3, e2: 0, e3: 2 })
  })

  it('counts a duplicated (employee,day) pair once (12h = one shift/day)', async () => {
    const asg: AsgRow[] = [
      { employee_id: 'e1', day_of_week: 0 },
      { employee_id: 'e1', day_of_week: 0 }, // duplicate — must not double-count
    ]
    const d = await computePriorDeficit(fakeDb(asg), PRIOR, [
      { id: 'e1', min_shifts_per_week: 3 },
    ])
    expect(d).toEqual({ e1: 2 })
  })

  it('returns {} when no prior period is supplied', async () => {
    const d = await computePriorDeficit(fakeDb([]), null, EMPS)
    expect(d).toEqual({})
  })
})
