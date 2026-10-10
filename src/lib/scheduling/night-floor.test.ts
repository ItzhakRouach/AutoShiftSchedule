// Part A1: nights have CAPS but no FLOOR. A heavy requester can satisfy every
// request and legitimately escape their night share, because night-evenness is
// gated by preservesRequestsFor (which forbids any drop in satisfied requests).
// The floor pass may spend ONE granted request to close that, never going below
// the employee's own floorTarget.
import { describe, it, expect } from 'vitest'
import { runFill } from './fill'
import { buildNightFloors } from './night-targets'
import { satisfiedCount, floorTarget } from './request-gate'
import { nightCount } from './fairness'
import { emp, input, reqFor, mergeReqs, buildRequests, GUARD } from './fixtures'
import type { EngineInput } from './types'

const DAYS = [0, 1, 2, 3, 4, 5]

/** 3 guards, 6 days, 1 morning + 1 night each day (12 slots).
 *  `heavy` requests the morning every day, so honoring all 6 requests leaves
 *  the 6 nights to the other two — heavy ends with zero nights.
 *  6 nights / 3 eligible ⇒ T = 2, so the floor is min(T-1, shifts/2) = 1. */
function heavyRequesterWeek(): EngineInput {
  const employees = ['heavy', 'x', 'y'].map((id) => emp(id, { roleIds: [GUARD] }))
  return input({
    employees,
    requirements: mergeReqs(
      reqFor(DAYS, 'morning', GUARD, 1),
      reqFor(DAYS, 'night', GUARD, 1),
    ),
    requests: buildRequests(employees, (id, day) =>
      id === 'heavy' && DAYS.includes(day) ? { preferred: ['morning'] } : {},
    ),
  })
}

describe('night floor', () => {
  it('pulls a heavy requester up to their night floor', () => {
    const inp = heavyRequesterWeek()
    const st = runFill(inp)
    const floors = buildNightFloors(inp, st.committed)
    expect(floors['heavy']).toBeGreaterThanOrEqual(1)
    expect(nightCount(st.committed['heavy'])).toBeGreaterThanOrEqual(floors['heavy'])
  })

  it('keeps the heavy requester at or above their own request floorTarget', () => {
    const inp = heavyRequesterWeek()
    const st = runFill(inp)
    const sat = satisfiedCount(inp, 'heavy', st.committed['heavy'])
    expect(sat).toBeGreaterThanOrEqual(floorTarget(inp, 'heavy'))
  })

  it('preserves coverage', () => {
    const inp = heavyRequesterWeek()
    const st = runFill(inp)
    const total = ['heavy', 'x', 'y'].reduce((n, id) => n + st.committed[id].length, 0)
    expect(total).toBe(12)
  })

  it('is deterministic', () => {
    const a = runFill(heavyRequesterWeek())
    const b = runFill(heavyRequesterWeek())
    expect(JSON.stringify(a.committed)).toBe(JSON.stringify(b.committed))
  })
})

describe('buildNightFloors', () => {
  it('never demands a night from a single-shift employee (proportional floor)', () => {
    const inp = heavyRequesterWeek()
    const floors = buildNightFloors(inp, { heavy: [], x: [], y: [] })
    // Zero committed shifts ⇒ floor(shifts/2) = 0 ⇒ floor 0 for everyone.
    for (const id of ['heavy', 'x', 'y']) expect(floors[id]).toBe(0)
  })

  it('is 0 for an employee whose availability bars nights', () => {
    const noNights = emp('nn', {
      roleIds: [GUARD],
      availability: Object.fromEntries(DAYS.map((d) => [d, ['morning'] as const])),
    })
    const others = ['x', 'y'].map((id) => emp(id, { roleIds: [GUARD] }))
    const inp = input({
      employees: [noNights, ...others],
      requirements: mergeReqs(
        reqFor(DAYS, 'morning', GUARD, 1),
        reqFor(DAYS, 'night', GUARD, 1),
      ),
    })
    const st = runFill(inp)
    const floors = buildNightFloors(inp, st.committed)
    expect(floors['nn']).toBe(0)
    expect(nightCount(st.committed['nn'] ?? [])).toBe(0)
  })
})
