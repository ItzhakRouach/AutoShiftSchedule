import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, buildRequests, emp, input, reqFor } from './fixtures'

describe('coverage-rescue (soft off override)', () => {
  it('overrides exactly ONE soft-off worker to cover a single open slot', () => {
    // 3 guards, all requested off on day 0; one morning slot. Rescue must pull in
    // exactly one (the others keep their day off), and record one override.
    const emps = ['a', 'b', 'c'].map((id) => emp(id, { roleIds: [GUARD] }))
    const requests = buildRequests(emps, (_id, d) => (d === 0 ? { off: true } : {}))
    const res = generateSchedule(
      input({ employees: emps, requirements: reqFor([0], 'morning', GUARD, 1), requests, seed: 1 }),
    )
    expect(res.warnings).toHaveLength(0)
    expect(res.overriddenOff).toHaveLength(1)
    const pulledIn = res.overriddenOff[0].employeeId
    const worked = emps.filter((e) => (res.assignmentsByEmployee[e.id] ?? []).length > 0)
    expect(worked.map((e) => e.id)).toEqual([pulledIn])
  })

  it('prefers overriding a worker who is otherwise idle (lowest load)', () => {
    // a is needed elsewhere (busy day 1); b is free. The day-0 gap should be
    // covered by b (lower load), leaving a's other work intact.
    const a = emp('a', { roleIds: [GUARD] })
    const b = emp('b', { roleIds: [GUARD] })
    const requests = buildRequests([a, b], (id, d) => {
      if (d === 0) return { off: true } // both off day 0
      if (id === 'a' && d === 1) return { preferred: ['morning'] } // a works day1
      return {}
    })
    const res = generateSchedule(
      input({
        employees: [a, b],
        requirements: { ...reqFor([0], 'morning', GUARD, 1), ...reqFor([1], 'morning', GUARD, 1) },
        requests,
        seed: 1,
      }),
    )
    // day-0 override should be b (a already has the day-1 shift → higher load)
    const d0 = res.overriddenOff.find((o) => o.day === 0)
    expect(d0?.employeeId).toBe('b')
  })

  it('never overrides a hard off (vacation/רענון)', () => {
    const a = emp('a', { roleIds: [GUARD] })
    const requests = buildRequests([a], (_id, d) => (d === 0 ? { offHard: true } : {}))
    const res = generateSchedule(
      input({ employees: [a], requirements: reqFor([0], 'morning', GUARD, 1), requests }),
    )
    expect(res.overriddenOff).toEqual([])
    expect(res.warnings).toHaveLength(1)
  })
})
