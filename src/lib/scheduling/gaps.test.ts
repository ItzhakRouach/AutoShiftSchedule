// Adversarial counterexample tests for the engine defects (FIX 1–6).
// Exact-assertion, hand-computed fixtures.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import {
  GUARD,
  DISPATCH,
  buildRequests,
  emp,
  input,
  mergeReqs,
  reqFor,
} from './fixtures'
import { would12hViolateRest } from './fallback'
import type { Assignment } from './types'

// FIX 1 — stable per-employee lottery, independent of array order.
describe('FIX 1: stable per-employee lottery', () => {
  it('same seed → same winner regardless of employees[] order; seed changes winner', () => {
    const reqs = buildRequests([emp('a'), emp('b'), emp('c')], (_id, d) =>
      d === 0 ? { preferred: ['morning'] } : {},
    )
    const winner = (order: string[], seed: number) =>
      generateSchedule(
        input({
          employees: order.map((id) => emp(id)),
          requirements: reqFor([0], 'morning', GUARD, 1),
          requests: reqs,
          seed,
        }),
      ).grid[0].morning[GUARD]
    const w = winner(['a', 'b', 'c'], 5)
    expect(winner(['c', 'b', 'a'], 5)).toEqual(w) // reversed
    expect(winner(['b', 'a', 'c'], 5)).toEqual(w) // shuffled
    // different seed may differ; here it does:
    expect(winner(['a', 'b', 'c'], 6)).not.toEqual(w)
  })
})

// FIX 2 — bipartite max-matching fills a day that first-fit would strand.
describe('FIX 2: max-matching per-day fill', () => {
  it('b→GUARD, a→DISPATCH yields 2/2 filled, 100% coverage (not 50%)', () => {
    const a = emp('a', { roleIds: [GUARD, DISPATCH] })
    const b = emp('b', { roleIds: [GUARD] })
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'morning', DISPATCH, 1),
    )
    const res = generateSchedule(input({ employees: [a, b], requirements: req }))
    expect(res.grid[0].morning[GUARD]).toEqual(['b'])
    expect(res.grid[0].morning[DISPATCH]).toEqual(['a'])
    expect(res.coverage.filledSlots).toBe(2)
    expect(res.coverage.requiredSlots).toBe(2)
    expect(res.coverage.percent).toBe(100)
    expect(res.warnings).toEqual([])
  })
})

// FIX 3 — feasibility via matching: no false short on a staffable multi-role week.
describe('FIX 3: feasibility via max-matching', () => {
  it('staffable multi-role day = ok; filled == required == maxStaffable', () => {
    const a = emp('a', { roleIds: [GUARD, DISPATCH] })
    const b = emp('b', { roleIds: [GUARD] })
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'morning', DISPATCH, 1),
    )
    const res = generateSchedule(input({ employees: [a, b], requirements: req }))
    expect(res.feasibility.status).toBe('ok')
    expect(res.feasibility.requiredSlots).toBe(2)
    expect(res.feasibility.maxStaffable).toBe(2)
    expect(res.feasibility.shortBy).toBe(0)
    expect(res.coverage.filledSlots).toBe(res.feasibility.maxStaffable)
  })
})

// FIX A — canonical precedence: full-time first ONLY while below their minimum.
describe('FIX A: candidate precedence', () => {
  it('part-time REQUESTER loses a scarce slot to a BELOW-MIN full-time NON-requester', () => {
    const partReq = emp('part', { employmentType: 'part' })
    const fullNon = emp('full', { employmentType: 'full', minShifts: 1 })
    const requests = buildRequests([partReq, fullNon], (id, d) =>
      id === 'part' && d === 0 ? { preferred: ['morning'] } : {},
    )
    const res = generateSchedule(
      input({ employees: [partReq, fullNon], requirements: reqFor([0], 'morning', GUARD, 1), requests, seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['full'])
  })

  it('two full-timers tie → the requester beats the non-requester', () => {
    const reqr = emp('reqr', { employmentType: 'full' })
    const non = emp('non', { employmentType: 'full' })
    const requests = buildRequests([reqr, non], (id, d) =>
      id === 'reqr' && d === 0 ? { preferred: ['morning'] } : {},
    )
    const res = generateSchedule(
      input({ employees: [reqr, non], requirements: reqFor([0], 'morning', GUARD, 1), requests, seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['reqr'])
  })
})

// FIX 5 — >=2 (else >=1) request floor via reservation matching.
describe('FIX 5: request floor via reservation matching', () => {
  it('a=2 / b=2 fixture: each requester gets >=2 (globally a=2,b=2 is feasible)', () => {
    const a = emp('a', { maxShifts: 7 })
    const b = emp('b', { maxShifts: 7 })
    const requests = buildRequests([a, b], () => ({ preferred: ['morning'] }))
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([1], 'morning', GUARD, 1),
      reqFor([2], 'morning', GUARD, 1),
      reqFor([3], 'morning', GUARD, 1),
    )
    const res = generateSchedule(input({ employees: [a, b], requirements: req, requests, seed: 1 }))
    expect(res.stats.a.requestsSatisfied).toBeGreaterThanOrEqual(2)
    expect(res.stats.b.requestsSatisfied).toBeGreaterThanOrEqual(2)
    expect(res.stats.a.requestsSatisfied).toBe(2)
    expect(res.stats.b.requestsSatisfied).toBe(2)
  })

  it('only >=1 feasible (2 days, 2 requesters): each gets exactly 1', () => {
    const a = emp('a')
    const b = emp('b')
    const requests = buildRequests([a, b], () => ({ preferred: ['morning'] }))
    const req = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([1], 'morning', GUARD, 1))
    const res = generateSchedule(input({ employees: [a, b], requirements: req, requests, seed: 1 }))
    expect(res.stats.a.requestsSatisfied).toBe(1)
    expect(res.stats.b.requestsSatisfied).toBe(1)
  })
})

// FIX 6 — 12h fallback rest check.
describe('FIX 6: would12hViolateRest', () => {
  it('flags a 12h variant that overlaps an adjacent committed shift', () => {
    // m12_day on day0 = 07:00–19:00. A committed noon (15:00–23:00) day0 overlaps.
    const committed: Assignment[] = [{ employeeId: 'x', day: 0, shift: 'noon', roleId: GUARD }]
    expect(would12hViolateRest('m12_day', 0, committed, 8)).toBe(true)
  })
  it('does NOT flag when no adjacent committed shift conflicts', () => {
    const committed: Assignment[] = [{ employeeId: 'x', day: 3, shift: 'morning', roleId: GUARD }]
    expect(would12hViolateRest('m12_day', 0, committed, 8)).toBe(false)
  })
})
