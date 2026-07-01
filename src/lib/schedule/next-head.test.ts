// Adapter unit: computeNextWeekHead mirrors computePriorWeekTail but looks
// FORWARD — given the immediately-following period (any status), return per
// employee the START abs-hours of their next-week shifts, expressed in the
// CURRENT week's frame ((day+7)*24 + start_hour). Used by validate-edit to
// block e.g. Sat-night (this week) → Sun-morning (next week).
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeNextWeekHead } from './next-head'

type ShiftTypeRow = { id: string; start_hour: number; hours: number }
type AsgRow = { employee_id: string; day_of_week: number; shift_type_id: string }

const SHIFT_TYPES: ShiftTypeRow[] = [
  { id: 'morning', start_hour: 7, hours: 8 },
  { id: 'noon', start_hour: 15, hours: 8 },
  { id: 'night', start_hour: 23, hours: 8 },
]

/** Chainable stub: shift_types + assignments queries resolve independently. */
function fakeDb(asg: AsgRow[]): SupabaseClient {
  const stChain = { eq: () => ({ then: (r: (v: { data: ShiftTypeRow[] }) => unknown) => r({ data: SHIFT_TYPES }) }) }
  const asgChain = { eq: () => ({ then: (r: (v: { data: AsgRow[] }) => unknown) => r({ data: asg }) }) }
  return {
    from: (table: string) => ({
      select: () => (table === 'shift_types' ? stChain : asgChain),
    }),
  } as unknown as SupabaseClient
}

const NEXT = { id: 'p2', week_start_date: '2026-06-14' }
const CURRENT_START = '2026-06-07'

describe('computeNextWeekHead', () => {
  it('returns {} when next is null', async () => {
    const head = await computeNextWeekHead(fakeDb([]), 'wp1', null, CURRENT_START)
    expect(head).toEqual({})
  })

  it('computes START abs hours in the current-week frame ((day+7)*24+start)', async () => {
    // Sunday (day 0) morning next week → (0+7)*24+7 = 175.
    const asg: AsgRow[] = [{ employee_id: 'a', day_of_week: 0, shift_type_id: 'morning' }]
    const head = await computeNextWeekHead(fakeDb(asg), 'wp1', NEXT, CURRENT_START)
    expect(head).toEqual({ a: [175] })
  })

  it('collects multiple shifts per employee', async () => {
    const asg: AsgRow[] = [
      { employee_id: 'a', day_of_week: 0, shift_type_id: 'morning' }, // 175
      { employee_id: 'a', day_of_week: 1, shift_type_id: 'noon' }, // (1+7)*24+15 = 207
    ]
    const head = await computeNextWeekHead(fakeDb(asg), 'wp1', NEXT, CURRENT_START)
    expect(head).toEqual({ a: [175, 207] })
  })

  it('returns {} when next period is not exactly 7 days after currentWeekStart', async () => {
    const asg: AsgRow[] = [{ employee_id: 'a', day_of_week: 0, shift_type_id: 'morning' }]
    const farNext = { id: 'p3', week_start_date: '2026-06-21' } // 14 days after
    const head = await computeNextWeekHead(fakeDb(asg), 'wp1', farNext, CURRENT_START)
    expect(head).toEqual({})
  })

  it('skips adjacency check when currentWeekStart is omitted (tests convenience)', async () => {
    const asg: AsgRow[] = [{ employee_id: 'a', day_of_week: 0, shift_type_id: 'morning' }]
    const head = await computeNextWeekHead(fakeDb(asg), 'wp1', NEXT)
    expect(head).toEqual({ a: [175] })
  })
})
