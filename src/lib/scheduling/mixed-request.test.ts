import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, buildRequests, emp, input, reqFor } from './fixtures'

// A "mixed" request offers alternatives: preferred shift(s) OR a day off.
describe('mixed request (shift OR off)', () => {
  it('keeps the worker available for the preferred shift despite the off flag', () => {
    const a = emp('a', { roleIds: [GUARD] })
    const requests = buildRequests([a], (_id, d) => (d === 0 ? { off: true, preferred: ['morning'] } : {}))
    const res = generateSchedule(
      input({ employees: [a], requirements: reqFor([0], 'morning', GUARD, 1), requests }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['a'])
  })

  it('is left off rather than forced into a NON-preferred shift when someone else can cover', () => {
    const a = emp('a', { roleIds: [GUARD] }) // morning OR off
    const b = emp('b', { roleIds: [GUARD] }) // freely available
    const requests = buildRequests([a, b], (id, d) =>
      id === 'a' && d === 0 ? { off: true, preferred: ['morning'] } : {},
    )
    // Day 0 needs a NOON guard. `a` prefers morning-or-off, so b takes noon and a is left off.
    const res = generateSchedule(
      input({ employees: [a, b], requirements: reqFor([0], 'noon', GUARD, 1), requests, seed: 1 }),
    )
    expect(res.grid[0].noon[GUARD]).toEqual(['b'])
    expect(res.assignmentsByEmployee.a ?? []).toEqual([])
  })
})
