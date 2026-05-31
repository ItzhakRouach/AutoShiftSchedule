import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import {
  GUARD,
  buildRequests,
  emp,
  input,
  mergeReqs,
  reqFor,
} from './fixtures'

describe('mustAccept', () => {
  it('off-day is always honored (hard) — never assigned that day', () => {
    const ma = emp('ma', { mustAccept: true })
    const requests = buildRequests([ma], (_id, d) => (d === 2 ? { off: true } : {}))
    const res = generateSchedule(
      input({ employees: [ma], requirements: reqFor([2], 'morning', GUARD, 1), requests }),
    )
    expect(res.assignmentsByEmployee.ma).toEqual([])
    expect(res.warnings).toHaveLength(1)
  })
  it('preferred shift prioritized over a non-requester for a scarce slot', () => {
    const ma = emp('ma', { mustAccept: true })
    const other = emp('other')
    const requests = buildRequests([ma, other], (id, d) =>
      id === 'ma' && d === 0 ? { preferred: ['morning'] } : {},
    )
    const res = generateSchedule(
      input({ employees: [ma, other], requirements: reqFor([0], 'morning', GUARD, 1), requests, seed: 2 }),
    )
    // seed 2 would pick 'other' (alphabetically/lottery) but mustAccept requester wins.
    expect(res.grid[0].morning[GUARD]).toEqual(['ma'])
  })
})

describe('employment-type ordering (FIX A — only among below-min employees)', () => {
  it('full-time fills a scarce slot before part-time and student (all below min)', () => {
    const employees = [
      emp('stud', { employmentType: 'student', minShifts: 1 }),
      emp('part', { employmentType: 'part', minShifts: 1 }),
      emp('full', { employmentType: 'full', minShifts: 1 }),
    ]
    const res = generateSchedule(
      input({ employees, requirements: reqFor([0], 'morning', GUARD, 1), seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['full'])
  })
})

describe('request-satisfaction floor', () => {
  it('guarantees >=1 when only one feasible request day', () => {
    const a = emp('a')
    const b = emp('b')
    // both request morning day0 (one slot) → loser still gets >=0; here only 1 day,
    // so the floor cannot promise >=1 to both. Assert the winner has >=1.
    const requests = buildRequests([a, b], (_id, d) => (d === 0 ? { preferred: ['morning'] } : {}))
    const res = generateSchedule(
      input({ employees: [a, b], requirements: reqFor([0], 'morning', GUARD, 1), requests, seed: 1 }),
    )
    const total = res.stats.a.requestsSatisfied + res.stats.b.requestsSatisfied
    expect(total).toBe(1)
  })
  it('spreads to guarantee >=1 each when each has a feasible day', () => {
    const a = emp('a')
    const b = emp('b')
    const requests = buildRequests([a, b], () => ({ preferred: ['morning'] }))
    const req = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([1], 'morning', GUARD, 1))
    const res = generateSchedule(input({ employees: [a, b], requirements: req, requests, seed: 1 }))
    // 2 morning slots (day0,day1), 2 requesters → reservation gives each exactly 1.
    expect(res.stats.a.requestsSatisfied).toBe(1)
    expect(res.stats.b.requestsSatisfied).toBe(1)
  })
  it('reaches >=2 satisfied when plenty of requested slots exist', () => {
    const a = emp('a', { maxShifts: 3 })
    const requests = buildRequests([a], () => ({ preferred: ['morning'] }))
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([1], 'morning', GUARD, 1),
      reqFor([2], 'morning', GUARD, 1),
    )
    const res = generateSchedule(input({ employees: [a], requirements: req, requests, seed: 1 }))
    // 3 requested morning days, maxShifts 3, sole candidate → all 3 satisfied.
    expect(res.stats.a.requestsSatisfied).toBe(3)
  })
})

describe('lottery determinism', () => {
  const employees = [emp('a'), emp('b'), emp('c')]
  const requests = buildRequests(employees, (_id, d) => (d === 0 ? { preferred: ['morning'] } : {}))
  const make = (seed: number) =>
    generateSchedule(
      input({ employees, requirements: reqFor([0], 'morning', GUARD, 1), requests, seed }),
    )

  it('fixed seed=1 → specific winner "a" (per-employee rank)', () => {
    expect(make(1).grid[0].morning[GUARD]).toEqual(['a'])
  })
  it('seed=2 → winner "b" (differs from seed 1)', () => {
    expect(make(2).grid[0].morning[GUARD]).toEqual(['b'])
  })
  it('seed=42 → winner "c"', () => {
    expect(make(42).grid[0].morning[GUARD]).toEqual(['c'])
  })
  it('same seed → identical result (re-run)', () => {
    expect(make(1).grid[0].morning[GUARD]).toEqual(make(1).grid[0].morning[GUARD])
    expect(make(42).grid).toEqual(make(42).grid)
  })

  // FIX 1: per-employee lottery rank — winner is independent of array order.
  it('reordering the employees array does NOT change the winner (same seed)', () => {
    const base = [emp('a'), emp('b'), emp('c')]
    const reqs = buildRequests(base, (_id, d) => (d === 0 ? { preferred: ['morning'] } : {}))
    const run = (order: typeof base) =>
      generateSchedule(
        input({ employees: order, requirements: reqFor([0], 'morning', GUARD, 1), requests: reqs, seed: 7 }),
      ).grid[0].morning[GUARD]
    const forward = run([emp('a'), emp('b'), emp('c')])
    const reversed = run([emp('c'), emp('b'), emp('a')])
    const shuffled = run([emp('b'), emp('c'), emp('a')])
    expect(reversed).toEqual(forward)
    expect(shuffled).toEqual(forward)
    expect(forward).toHaveLength(1)
  })
})
