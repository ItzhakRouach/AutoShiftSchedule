import { describe, it, expect } from 'vitest'
import { isAssignable, type CheckContext } from './constraints'
import { canTwelve, type TwelveCtx } from './twelve-rules'
import { runFill } from './fill'
import { nightCount } from './fairness'
import { emp, input, reqFor, mergeReqs, buildRequests, settings, GUARD } from './fixtures'
import type { DayRequest, ShiftKey, TwelveHourKey } from './types'

const freeReq: DayRequest = { off: false, offHard: false, preferred: [] }
const nightReq: DayRequest = { off: false, offHard: false, preferred: ['night'] }

function baseCtx(over: Partial<CheckContext> = {}): CheckContext {
  return {
    emp: emp('m', { mustAccept: true }),
    meta: { index: 0, isHolidayEve: false, isHoliday: false },
    shift: 'night',
    roleId: GUARD,
    request: freeReq,
    current: [],
    settings: settings(),
    ...over,
  }
}

function twelveCtx(variant: TwelveHourKey, over: Partial<TwelveCtx> = {}): TwelveCtx {
  return {
    emp: emp('m', { mustAccept: true }),
    meta: { index: 0, isHolidayEve: false, isHoliday: false },
    variant,
    request: freeReq,
    current: [],
    settings: settings({ allow12hFallback: true }),
    ...over,
  }
}

describe('must_accept workers never get unrequested nights (hard)', () => {
  it('blocks an unrequested night for a must_accept worker', () => {
    expect(isAssignable(baseCtx())).toBe(false)
  })

  it('allows a night the must_accept worker requested', () => {
    expect(isAssignable(baseCtx({ request: nightReq }))).toBe(true)
  })

  it('does not block morning/noon for a must_accept worker without requests', () => {
    for (const shift of ['morning', 'noon'] as ShiftKey[]) {
      expect(isAssignable(baseCtx({ shift }))).toBe(true)
    }
  })

  it('does not affect regular (non-must_accept) workers', () => {
    expect(isAssignable(baseCtx({ emp: emp('r') }))).toBe(true)
  })

  it('stays blocked even under allowSoftOff (coverage-rescue)', () => {
    expect(isAssignable(baseCtx(), { allowSoftOff: true })).toBe(false)
  })

  it('blocks 12h variants covering night, allows the day variant', () => {
    expect(canTwelve(twelveCtx('m12_night'))).toBe(false)
    expect(canTwelve(twelveCtx('m12_3to15'))).toBe(false)
    expect(canTwelve(twelveCtx('m12_15to3'))).toBe(false)
    expect(canTwelve(twelveCtx('m12_day'))).toBe(true)
  })

  it('allows a night-covering 12h when the worker requested night', () => {
    expect(canTwelve(twelveCtx('m12_night', { request: nightReq }))).toBe(true)
  })
})

describe('must_accept night block — full fill integration', () => {
  const days = [0, 1, 2, 3, 4, 5, 6]
  const requirements = mergeReqs(
    reqFor(days, 'night', GUARD, 2),
    reqFor(days, 'morning', GUARD, 1),
    reqFor(days, 'noon', GUARD, 1),
  )

  it('a must_accept worker with no requests ends the week with zero nights', () => {
    const ma = emp('ma', { mustAccept: true, minShifts: 5, maxShifts: 6 })
    const others = Array.from({ length: 6 }, (_, i) =>
      emp(`o${i}`, { minShifts: 5, maxShifts: 6 }),
    )
    const st = runFill(input({ employees: [ma, ...others], requirements, seed: 3 }))
    expect(nightCount(st.committed['ma'] ?? [])).toBe(0)
  })

  it('a must_accept worker who requested nights gets nights only on those days', () => {
    const ma = emp('ma', { mustAccept: true, minShifts: 2, maxShifts: 6 })
    const others = Array.from({ length: 6 }, (_, i) =>
      emp(`o${i}`, { minShifts: 5, maxShifts: 6 }),
    )
    const employees = [ma, ...others]
    const requests = buildRequests(employees, (id, day) =>
      id === 'ma' && (day === 0 || day === 1) ? { preferred: ['night'] } : {},
    )
    const st = runFill(input({ employees, requirements, requests, seed: 3 }))
    const maNights = (st.committed['ma'] ?? []).filter((a) => a.shift === 'night')
    expect(maNights.length).toBeGreaterThan(0)
    for (const a of maNights) expect([0, 1]).toContain(a.day)
  })
})
