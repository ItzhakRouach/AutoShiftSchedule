import { describe, it, expect } from 'vitest'
import { runFill } from './fill'
import { nightCount } from './fairness'
import { buildNightThresholds } from './night-targets'
import { emp, input, reqFor, mergeReqs, buildRequests, GUARD } from './fixtures'
import type { EngineInput } from './types'

const days = [0, 1, 2, 3, 4, 5, 6]

function nightSpreadOf(inp: EngineInput): { counts: number[]; spread: number } {
  const st = runFill(inp)
  const thr = buildNightThresholds(inp)
  const finite = inp.employees.filter((e) => Number.isFinite(thr[e.id]))
  const counts = finite.map((e) => nightCount(st.committed[e.id] ?? []))
  return { counts, spread: Math.max(...counts) - Math.min(...counts) }
}

describe('even night distribution (strong preference)', () => {
  it('7 nights / 7 guards → every guard gets exactly one night', () => {
    for (const seed of [1, 2, 3]) {
      const employees = Array.from({ length: 7 }, (_, i) => emp(`g${i}`, { minShifts: 3, maxShifts: 6 }))
      const requirements = mergeReqs(
        reqFor(days, 'night', GUARD, 1),
        reqFor(days, 'morning', GUARD, 1),
        reqFor(days, 'noon', GUARD, 1),
      )
      const { spread } = nightSpreadOf(input({ employees, requirements, seed }))
      expect(spread).toBeLessThanOrEqual(1)
    }
  })

  it('8 nights / 7 guards (2 on some days) → spread stays ≤ 1', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const employees = Array.from({ length: 7 }, (_, i) => emp(`g${i}`, { minShifts: 4, maxShifts: 6 }))
      const requirements = mergeReqs(
        reqFor([0, 1, 2, 3], 'night', GUARD, 2),
        reqFor(days, 'morning', GUARD, 1),
        reqFor(days, 'noon', GUARD, 1),
      )
      const { spread } = nightSpreadOf(input({ employees, requirements, seed }))
      expect(spread).toBeLessThanOrEqual(1)
    }
  })

  it('10 nights / 6 guards on an uneven week → spread stays ≤ 1', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const employees = Array.from({ length: 6 }, (_, i) => emp(`g${i}`, { minShifts: 4, maxShifts: 6 }))
      const requirements = mergeReqs(
        reqFor([0, 1, 2], 'night', GUARD, 2),
        reqFor([3, 4, 5, 6], 'night', GUARD, 1),
        reqFor(days, 'morning', GUARD, 1),
        reqFor(days, 'noon', GUARD, 1),
      )
      const { spread } = nightSpreadOf(input({ employees, requirements, seed }))
      expect(spread).toBeLessThanOrEqual(1)
    }
  })

  it('a 4-night requester keeps their nights; the remaining 3 spread evenly among the rest', () => {
    for (const seed of [1, 2, 3]) {
      const employees = Array.from({ length: 7 }, (_, i) => emp(`g${i}`, { minShifts: 3, maxShifts: 6 }))
      const requests = buildRequests(employees, (id, day) =>
        id === 'g0' && day < 4 ? { preferred: ['night'] } : {},
      )
      const requirements = mergeReqs(
        reqFor(days, 'night', GUARD, 1),
        reqFor(days, 'morning', GUARD, 1),
        reqFor(days, 'noon', GUARD, 1),
      )
      const inp = input({ employees, requirements, requests, seed })
      const st = runFill(inp)
      // Requester keeps all 4 requested nights (days 0–3).
      const g0Nights = (st.committed['g0'] ?? []).filter((a) => a.shift === 'night')
      expect(g0Nights.length).toBe(4)
      // Remaining 3 nights spread over the other 6 guards: nobody gets 2.
      for (let i = 1; i < 7; i++) {
        expect(nightCount(st.committed[`g${i}`] ?? [])).toBeLessThanOrEqual(1)
      }
    }
  })
})
