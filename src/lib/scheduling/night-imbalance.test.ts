import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { emp, input, reqFor, mergeReqs, GUARD } from './fixtures'
import type { ShiftKey } from './types'

const days = [0, 1, 2, 3, 4, 5, 6]
const nightOnlyAvail = Object.fromEntries(days.map((d) => [d, ['night'] as ShiftKey[]]))

describe('EngineResult.nightImbalance', () => {
  it('lists a worker stuck above the even-share target when others cannot absorb nights', () => {
    // Pool = {g0, g1} → T = ceil(7/2) = 4, but g1 (maxShifts 1) can take only one
    // night. g0 ends up with 6 — over target, with no legal swap to fix it.
    const g0 = emp('g0')
    const g1 = emp('g1', { maxShifts: 1 })
    const res = generateSchedule(
      input({ employees: [g0, g1], requirements: reqFor(days, 'night', GUARD, 1), skipTwelve: true }),
    )
    const over = res.nightImbalance.find((n) => n.employeeId === 'g0')
    expect(over).toBeDefined()
    expect(over!.nights).toBeGreaterThan(over!.target)
    expect(over!.target).toBe(4)
  })

  it('is empty on a balanced week', () => {
    const employees = Array.from({ length: 7 }, (_, i) => emp(`g${i}`, { minShifts: 3, maxShifts: 6 }))
    const requirements = mergeReqs(
      reqFor(days, 'night', GUARD, 1),
      reqFor(days, 'morning', GUARD, 1),
      reqFor(days, 'noon', GUARD, 1),
    )
    const res = generateSchedule(input({ employees, requirements, skipTwelve: true }))
    expect(res.nightImbalance).toEqual([])
  })

  it('never lists a night-only (exempt) worker', () => {
    const adel = emp('adel', { availability: nightOnlyAvail })
    const others = Array.from({ length: 2 }, (_, i) => emp(`g${i}`))
    const res = generateSchedule(
      input({
        employees: [adel, ...others],
        requirements: reqFor(days, 'night', GUARD, 2),
        skipTwelve: true,
      }),
    )
    expect(res.nightImbalance.map((n) => n.employeeId)).not.toContain('adel')
  })
})
