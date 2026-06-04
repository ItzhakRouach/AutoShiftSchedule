// Step 2b "tight-availability first": within below-min, an employee whose legal
// slots are restricted (explicit availability map or Shabbat/holiday observance)
// reserves their min BEFORE an unrestricted employee — otherwise the
// unrestricted employee absorbs the slots both can take, and the restricted one
// gets squeezed below their minimum. Documented behaviour from
// docs/scheduling-engine.md step 2b.
import { describe, it, expect } from 'vitest'
import { compareCandidates, hasTightAvailability } from './scoring'
import type { CandidateState } from './scoring'
import { generateSchedule } from './engine'
import { GUARD, emp, input, reqFor } from './fixtures'
import type { Assignment } from './types'

function cand(over: Partial<CandidateState> & { emp: CandidateState['emp'] }): CandidateState {
  return {
    requested: false,
    mustAcceptRequested: false,
    current: [],
    requestsSatisfied: 0,
    lotteryRank: 0,
    ...over,
  }
}

describe('hasTightAvailability', () => {
  it('false for unrestricted full-timer (null availability, no observance)', () => {
    expect(hasTightAvailability(emp('a'))).toBe(false)
  })
  it('true when availability map is set', () => {
    expect(hasTightAvailability(emp('a', { availability: { 0: ['morning'] } }))).toBe(true)
  })
  it('true when observesShabbat is true', () => {
    expect(hasTightAvailability(emp('a', { observesShabbat: true }))).toBe(true)
  })
  it('true when observesHolidays is true', () => {
    expect(hasTightAvailability(emp('a', { observesHolidays: true }))).toBe(true)
  })
})

describe('compareCandidates step 2b: tight-availability first within below-min', () => {
  // A: full-time below-min, unrestricted (tier=0 normally).
  // B: full-time below-min, Shabbat observer (tier=0 but tight).
  // B should rank ahead of A because tight beats unrestricted within below-min.
  it('Shabbat-observing below-min beats unrestricted below-min (same tier)', () => {
    const a = cand({ emp: emp('a', { minShifts: 5, observesShabbat: false }) })
    const b = cand({ emp: emp('b', { minShifts: 5, observesShabbat: true }) })
    expect(compareCandidates(a, b)).toBeGreaterThan(0) // b wins (lower output)
    expect(compareCandidates(b, a)).toBeLessThan(0)
  })

  it('availability-map below-min beats unrestricted below-min', () => {
    const a = cand({ emp: emp('a', { minShifts: 5 }) })
    const b = cand({ emp: emp('b', { minShifts: 5, availability: { 0: ['morning'] } }) })
    expect(compareCandidates(a, b)).toBeGreaterThan(0)
  })

  // priorDeficit still beats tight-availability (sub-key 2a runs before 2b).
  it('priorDeficit (2a) still beats tight-availability (2b)', () => {
    const a = cand({ emp: emp('a', { minShifts: 5, priorDeficit: 3 }) })
    const b = cand({ emp: emp('b', { minShifts: 5, observesShabbat: true, priorDeficit: 0 }) })
    expect(compareCandidates(a, b)).toBeLessThan(0) // a (higher deficit) wins
  })

  // Tight-availability does NOT apply across the below-min / at-min boundary —
  // an at-min tight employee still loses to a below-min unrestricted employee.
  it('below-min unrestricted beats at-min tight (step 2 outer check)', () => {
    const oneShift: Assignment[] = [{ employeeId: 'b', day: 0, shift: 'morning', roleId: 'r' }]
    const a = cand({ emp: emp('a', { minShifts: 1, observesShabbat: false }) })
    const b = cand({ emp: emp('b', { minShifts: 1, observesShabbat: true }), current: oneShift })
    expect(compareCandidates(a, b)).toBeLessThan(0) // a (below-min) wins
  })

  // Tight-availability does NOT separate at-min candidates (only sub-keys
  // within step 2 apply). Among at-min, fairness/lottery decide.
  it('among at-min candidates, tight-availability does NOT confer priority', () => {
    const one: Assignment[] = [{ employeeId: 'x', day: 0, shift: 'morning', roleId: 'r' }]
    const a = cand({ emp: emp('a', { minShifts: 1, observesShabbat: false }), current: one })
    const b = cand({ emp: emp('b', { minShifts: 1, observesShabbat: true }), current: one })
    // Equal current load → fairnessScore identical → lottery decides → equal
    // ranks here → 0 (same lotteryRank).
    expect(compareCandidates(a, b)).toBe(0)
  })
})

describe('end-to-end: tight-availability employee reaches min', () => {
  // Two full-timers, both with min=1. One unrestricted, one Shabbat-observing.
  // Only one Friday morning slot is needed (a slot the Shabbat-observer CAN
  // work). The unrestricted full-timer has lots of OTHER days/shifts available;
  // the Shabbat-observer has limited options. The Shabbat-observer should win
  // this slot so they reach min, leaving the unrestricted full-timer to fill
  // some other slot.
  it('Shabbat-observer wins a shared Friday-morning slot when both are below-min', () => {
    const unrestricted = emp('u', { employmentType: 'full', minShifts: 1, maxShifts: 5 })
    const shabbat = emp('s', { employmentType: 'full', minShifts: 1, maxShifts: 5, observesShabbat: true })
    // Day 5 = Friday. Shabbat observer can work Friday morning (the block is
    // Fri noon+night per project rules), so the slot is shared.
    const requirements = reqFor([5], 'morning', GUARD, 1)
    const res = generateSchedule(
      input({ employees: [unrestricted, shabbat], requirements, seed: 1 }),
    )
    expect(res.grid[5].morning[GUARD]).toEqual(['s'])
  })
})
