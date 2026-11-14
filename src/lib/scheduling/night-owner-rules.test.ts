// Owner rules for nights (2026-11-14):
//  - a night counts as WANTED only when it is the only shift marked that day;
//    marking several shifts means "any of these is fine";
//  - a day with several acceptable shifts is ONE request, met by any of them;
//  - everyone who can work nights ends within one night of each other,
//    whatever they marked — a 19:00–07:00 counts as a night.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { buildNightThresholds, nightEligible } from './night-targets'
import { requestCount, satisfiedCount } from './request-gate'
import { nightCount } from './fairness'
import { DISPATCH, GUARD, SHIFT_MGR, buildRequests, emp, input, mergeReqs, reqFor, settings } from './fixtures'
import type { Employee, ShiftKey } from './types'

const ALL: ShiftKey[] = ['morning', 'noon', 'night']
const days = [0, 1, 2, 3, 4, 5, 6]
const ROLES = [SHIFT_MGR, DISPATCH, GUARD]
const week = mergeReqs(...ALL.flatMap((s) => ROLES.map((r) => reqFor(days, s, r, 1))))
const crew = (n: number): Employee[] =>
  Array.from({ length: n }, (_, i) => emp(`w${String(i + 1).padStart(2, '0')}`, { roleIds: ROLES, minShifts: 5, maxShifts: 6 }))
const spread = (res: ReturnType<typeof generateSchedule>, ids: string[]) => {
  const n = ids.map((id) => nightCount(res.assignmentsByEmployee[id] ?? []))
  return Math.max(...n) - Math.min(...n)
}

describe('what a night request means', () => {
  it('several marked shifts make one request per day, met by any of them', () => {
    const [a] = crew(1)
    const inp = input({ employees: [a], requirements: week, requests: buildRequests([a], (_id, d) => (d < 3 ? { preferred: ALL } : {})) })
    expect(requestCount(inp, a.id)).toBe(3)
    expect(satisfiedCount(inp, a.id, [{ employeeId: a.id, day: 0, shift: 'morning', roleId: GUARD }])).toBe(1)
  })

  it('marking night among other shifts does not raise a worker above the even night share', () => {
    const staff = crew(12)
    const inp = input({
      employees: staff, requirements: week,
      requests: buildRequests(staff, (id) => (id === 'w01' || id === 'w02' ? { preferred: ALL } : {})),
    })
    const t = buildNightThresholds(inp)
    expect(new Set(staff.map((e) => t[e.id])).size).toBe(1)
  })

  it('a night that is the only shift marked still counts as wanted', () => {
    const staff = crew(12)
    const inp = input({
      employees: staff, requirements: week,
      requests: buildRequests(staff, (id) => (id === 'w01' ? { preferred: ['night'] } : {})),
    })
    const t = buildNightThresholds(inp)
    expect(t.w01).toBe(7)
    expect(t.w02).toBeLessThan(7)
  })
})

describe('nights within one of each other', () => {
  for (const seed of [1, 2, 3]) {
    it(`flexible "any shift" workers carry their share and no more (seed ${seed})`, () => {
      const staff = crew(12)
      const res = generateSchedule(input({
        employees: staff, requirements: week, seed, settings: settings(),
        requests: buildRequests(staff, (id) => (id === 'w01' || id === 'w02' ? { preferred: ALL } : {})),
      }))
      expect(spread(res, nightEligible(input({ employees: staff, requirements: week })))).toBeLessThanOrEqual(1)
    })

    it(`day-shift requesters do not escape nights (seed ${seed})`, () => {
      const staff = crew(12)
      const res = generateSchedule(input({
        employees: staff, requirements: week, seed, settings: settings(),
        requests: buildRequests(staff, (id) => (id === 'w01' || id === 'w02' ? { preferred: ['morning', 'noon'] } : {})),
      }))
      expect(spread(res, staff.map((e) => e.id))).toBeLessThanOrEqual(1)
    })
  }
})
