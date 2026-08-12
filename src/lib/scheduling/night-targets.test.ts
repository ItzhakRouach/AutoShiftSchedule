import { describe, it, expect } from 'vitest'
import {
  buildNightThresholds,
  countRequiredNights,
  nightEligible,
  DEFAULT_NIGHT_CAP,
} from './night-targets'
import { emp, input, reqFor, mergeReqs, buildRequests, GUARD, DISPATCH } from './fixtures'
import type { ShiftKey } from './types'

const days = [0, 1, 2, 3, 4, 5, 6]
const nightOnlyAvail = Object.fromEntries(days.map((d) => [d, ['night'] as ShiftKey[]]))
const dayOnlyAvail = Object.fromEntries(days.map((d) => [d, ['morning', 'noon'] as ShiftKey[]]))

describe('countRequiredNights', () => {
  it('sums night slots across days and roles', () => {
    const reqs = mergeReqs(
      reqFor(days, 'night', GUARD, 2),
      reqFor([0, 1], 'night', DISPATCH, 1),
      reqFor(days, 'morning', GUARD, 3),
    )
    expect(countRequiredNights(reqs)).toBe(16)
  })

  it('is zero when no nights are required', () => {
    expect(countRequiredNights(reqFor(days, 'morning', GUARD, 2))).toBe(0)
  })
})

describe('nightEligible', () => {
  it('excludes must_accept workers with no night requests, day-only availability, and non-night roles', () => {
    const employees = [
      emp('a'),
      emp('ma', { mustAccept: true }),
      emp('day', { availability: dayOnlyAvail }),
      emp('dsp', { roleIds: [DISPATCH] }),
    ]
    const inp = input({ employees, requirements: reqFor(days, 'night', GUARD, 1) })
    expect(nightEligible(inp)).toEqual(['a'])
  })

  it('includes a must_accept worker who requested nights', () => {
    const employees = [emp('a'), emp('ma', { mustAccept: true })]
    const requests = buildRequests(employees, (id, day) =>
      id === 'ma' && day === 0 ? { preferred: ['night'] } : {},
    )
    const inp = input({ employees, requirements: reqFor(days, 'night', GUARD, 1), requests })
    expect(nightEligible(inp)).toEqual(['a', 'ma'])
  })
})

describe('buildNightThresholds (target-based)', () => {
  it('divides nights evenly: 14 nights / 7 guards → threshold 2 each', () => {
    const employees = Array.from({ length: 7 }, (_, i) => emp(`g${i}`))
    const inp = input({ employees, requirements: reqFor(days, 'night', GUARD, 2) })
    const thr = buildNightThresholds(inp)
    for (const e of employees) expect(thr[e.id]).toBe(2)
  })

  it('a heavy requester absorbs their own share without inflating others', () => {
    // 7 nights / 4 guards: T0=2, h requests 5 → remaining 7-(5-2)=4 → T=1.
    const employees = [emp('h'), emp('b'), emp('c'), emp('d')]
    const requests = buildRequests(employees, (id, day) =>
      id === 'h' && day < 5 ? { preferred: ['night'] } : {},
    )
    const inp = input({ employees, requirements: reqFor(days, 'night', GUARD, 1), requests })
    const thr = buildNightThresholds(inp)
    expect(thr['h']).toBe(5)
    expect(thr['b']).toBe(1)
    expect(thr['c']).toBe(1)
    expect(thr['d']).toBe(1)
  })

  it('night-only availability stays exempt (Infinity)', () => {
    const employees = [emp('n', { availability: nightOnlyAvail }), emp('a'), emp('b')]
    const inp = input({ employees, requirements: reqFor(days, 'night', GUARD, 1) })
    expect(buildNightThresholds(inp)['n']).toBe(Infinity)
  })

  it('must_accept without night requests is out of the pool but present in the map', () => {
    // 7 nights / 3 eligible guards → T=3; ma gets T for safety (hard rule blocks anyway).
    const employees = [emp('a'), emp('b'), emp('c'), emp('ma', { mustAccept: true })]
    const inp = input({ employees, requirements: reqFor(days, 'night', GUARD, 1) })
    const thr = buildNightThresholds(inp)
    expect(thr['a']).toBe(3)
    expect(thr['b']).toBe(3)
    expect(thr['c']).toBe(3)
    expect(thr['ma']).toBe(3)
  })

  it('falls back to DEFAULT_NIGHT_CAP when nobody is eligible', () => {
    const employees = [emp('ma', { mustAccept: true }), emp('day', { availability: dayOnlyAvail })]
    const inp = input({ employees, requirements: reqFor(days, 'night', GUARD, 1) })
    const thr = buildNightThresholds(inp)
    expect(thr['ma']).toBe(DEFAULT_NIGHT_CAP)
    expect(thr['day']).toBe(DEFAULT_NIGHT_CAP)
  })

  it('falls back to DEFAULT_NIGHT_CAP when no nights are required', () => {
    const employees = [emp('a'), emp('b')]
    const inp = input({ employees, requirements: reqFor(days, 'morning', GUARD, 1) })
    const thr = buildNightThresholds(inp)
    expect(thr['a']).toBe(DEFAULT_NIGHT_CAP)
    expect(thr['b']).toBe(DEFAULT_NIGHT_CAP)
  })

  it('pool ignores workers whose roles have no required nights', () => {
    // 7 GUARD nights; dispatcher can never take them → guards' T = ceil(7/3) = 3.
    const employees = [emp('a'), emp('b'), emp('c'), emp('dsp', { roleIds: [DISPATCH] })]
    const inp = input({ employees, requirements: reqFor(days, 'night', GUARD, 1) })
    const thr = buildNightThresholds(inp)
    expect(thr['a']).toBe(3)
    expect(thr['b']).toBe(3)
    expect(thr['c']).toBe(3)
  })
})
