import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, emp, input, reqFor, mergeReqs, buildRequests } from './fixtures'

describe('night → off avoidance', () => {
  it('keeps a night worker working the next day instead of off', () => {
    const n = emp('N', { roleIds: [GUARD] })
    const w = emp('W', { roleIds: [GUARD] })
    // N requests the day-0 night; day 1 has a noon slot either can take.
    const requests = buildRequests([n, w], (id, d) => (id === 'N' && d === 0 ? { preferred: ['night'] } : {}))
    const reqs = mergeReqs(reqFor([0], 'night', GUARD, 1), reqFor([1], 'noon', GUARD, 1))
    const res = generateSchedule(input({ employees: [n, w], requirements: reqs, requests, seed: 1 }))
    const nAssigns = res.assignmentsByEmployee['N'] ?? []
    expect(nAssigns.some((a) => a.day === 0 && a.shift === 'night')).toBe(true) // worked the night
    expect(nAssigns.some((a) => a.day === 1)).toBe(true) // ...and is NOT left off the next day
  })

  it('still allows night→off when the next day off was REQUESTED', () => {
    const n = emp('N', { roleIds: [GUARD] })
    const w = emp('W', { roleIds: [GUARD] })
    const requests = buildRequests([n, w], (id, d) => {
      if (id === 'N' && d === 0) return { preferred: ['night'] }
      if (id === 'N' && d === 1) return { off: true } // explicitly wants the day off
      return {}
    })
    const reqs = mergeReqs(reqFor([0], 'night', GUARD, 1), reqFor([1], 'noon', GUARD, 1))
    const res = generateSchedule(input({ employees: [n, w], requirements: reqs, requests, seed: 1 }))
    const nAssigns = res.assignmentsByEmployee['N'] ?? []
    expect(nAssigns.some((a) => a.day === 1)).toBe(false) // requested off is honored
  })
})
