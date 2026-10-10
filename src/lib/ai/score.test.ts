// Scoring both candidate weeks with the ENGINE'S OWN pure functions, so the
// comparison cannot drift from what the engine optimises for.
import { describe, it, expect } from 'vitest'
import { scoreSchedule, compareScores } from './score'
import { generateSchedule } from '@/lib/scheduling'
import { emp, input, reqFor, mergeReqs, buildRequests, GUARD, SHIFT_MGR } from '@/lib/scheduling/fixtures'

const full = () => {
  const i = input({
    employees: [emp('u1', { roleIds: [GUARD] }), emp('u2', { roleIds: [GUARD] })],
    requirements: mergeReqs(reqFor([0, 2], 'morning', GUARD, 1), reqFor([1, 3], 'night', GUARD, 1)),
  })
  return { i, r: generateSchedule(i) }
}

const short = () => {
  const i = input({
    employees: [emp('u1', { roleIds: [GUARD] })],
    requirements: reqFor([0], 'night', SHIFT_MGR, 1), // nobody holds it
  })
  return { i, r: generateSchedule(i) }
}

describe('scoreSchedule', () => {
  it('reports coverage, requests, below-min and 12h counts', () => {
    const { i, r } = full()
    const s = scoreSchedule(i, r)
    expect(s.requiredSlots).toBe(4)
    expect(s.filledSlots).toBe(4)
    expect(s.coveragePercent).toBe(100)
    expect(s.twelveHourCount).toBe(0)
    expect(s.belowMinCount).toBe(0)
  })

  it('counts satisfied requests across the roster', () => {
    const employees = [emp('u1', { roleIds: [GUARD] })]
    const i = input({
      employees,
      requirements: mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([2], 'morning', GUARD, 1)),
      requests: buildRequests(employees, (_id, day) =>
        day === 0 || day === 2 ? { preferred: ['morning'] } : {},
      ),
    })
    expect(scoreSchedule(i, generateSchedule(i)).requestsSatisfied).toBe(2)
  })

  it('reports a short week as under 100% coverage', () => {
    const { i, r } = short()
    const s = scoreSchedule(i, r)
    expect(s.filledSlots).toBe(0)
    expect(s.coveragePercent).toBe(0)
  })

  it('reports the night spread across the roster', () => {
    const i = input({
      employees: [emp('u1', { roleIds: [GUARD] }), emp('u2', { roleIds: [GUARD] })],
      requirements: reqFor([0, 2, 4], 'night', GUARD, 1),
    })
    const s = scoreSchedule(i, generateSchedule(i))
    expect(s.nightSpread).toBeGreaterThanOrEqual(0)
    expect(s.nightSpread).toBeLessThanOrEqual(3)
  })
})

describe('compareScores', () => {
  const base = {
    requiredSlots: 10, filledSlots: 10, coveragePercent: 100, requestsSatisfied: 5,
    belowMinCount: 0, nightSpread: 1, nightImbalanceCount: 0, twelveHourCount: 0,
    diversityCost: 100,
  }

  it('prefers more coverage above everything else', () => {
    const worseCoverage = { ...base, filledSlots: 9, requestsSatisfied: 99 }
    expect(compareScores(base, worseCoverage)).toBeLessThan(0)
  })

  it('prefers more satisfied requests when coverage ties', () => {
    expect(compareScores({ ...base, requestsSatisfied: 6 }, base)).toBeLessThan(0)
  })

  it('prefers fewer below-minimum workers when coverage and requests tie', () => {
    expect(compareScores(base, { ...base, belowMinCount: 1 })).toBeLessThan(0)
  })

  it('prefers fewer night-imbalance warnings, then fewer 12h shifts', () => {
    expect(compareScores(base, { ...base, nightImbalanceCount: 1 })).toBeLessThan(0)
    expect(compareScores(base, { ...base, twelveHourCount: 1 })).toBeLessThan(0)
  })

  it('falls back to the engine diversity cost', () => {
    expect(compareScores(base, { ...base, diversityCost: 200 })).toBeLessThan(0)
  })

  it('is 0 for identical scores', () => {
    expect(compareScores(base, { ...base })).toBe(0)
  })
})
