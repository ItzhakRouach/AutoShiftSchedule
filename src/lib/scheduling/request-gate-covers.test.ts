import { describe, it, expect } from 'vitest'
import { satisfiedCount } from './request-gate'
import { generateSchedule } from './engine'
import { GUARD, emp, input, buildRequests } from './fixtures'
import type { Assignment, EngineInput } from './types'

function inputWithPrefs(prefs: Record<number, ('morning' | 'noon' | 'night')[]>): EngineInput {
  const employees = [emp('e1')]
  const requests = buildRequests(employees, (_id, d) => ({ preferred: prefs[d] ?? [] }))
  return input({ employees, requests })
}

describe('satisfiedCount — 12h COVERS semantics', () => {
  it('base assignment matching preferred counts (unchanged behavior)', () => {
    const inp = inputWithPrefs({ 0: ['morning'] })
    const a: Assignment[] = [{ employeeId: 'e1', day: 0, shift: 'morning', roleId: GUARD }]
    expect(satisfiedCount(inp, 'e1', a)).toBe(1)
  })

  it('m12_day covering a requested morning counts exactly once (two committed rows, one variant)', () => {
    const inp = inputWithPrefs({ 0: ['morning'] })
    // commitTwelve pushes one row per FILLS window: morning + noon, same variant.
    const a: Assignment[] = [
      { employeeId: 'e1', day: 0, shift: 'morning', roleId: GUARD, is12h: true, variant: 'm12_day' },
      { employeeId: 'e1', day: 0, shift: 'noon', roleId: GUARD, is12h: true, variant: 'm12_day' },
    ]
    expect(satisfiedCount(inp, 'e1', a)).toBe(1)
  })

  it('m12_night covering a requested NOON counts (COVERS, not FILLS)', () => {
    const inp = inputWithPrefs({ 0: ['noon'] })
    // m12_night commits only a night row (FILLS=[night]) but physically covers noon.
    const a: Assignment[] = [
      { employeeId: 'e1', day: 0, shift: 'night', roleId: GUARD, is12h: true, variant: 'm12_night' },
    ]
    expect(satisfiedCount(inp, 'e1', a)).toBe(1)
  })

  it('m12_night for a night requester counts', () => {
    const inp = inputWithPrefs({ 2: ['night'] })
    const a: Assignment[] = [
      { employeeId: 'e1', day: 2, shift: 'night', roleId: GUARD, is12h: true, variant: 'm12_night' },
    ]
    expect(satisfiedCount(inp, 'e1', a)).toBe(1)
  })

  it('two preferred windows both covered by one 12h count as two satisfied', () => {
    const inp = inputWithPrefs({ 0: ['morning', 'noon'] })
    const a: Assignment[] = [
      { employeeId: 'e1', day: 0, shift: 'morning', roleId: GUARD, is12h: true, variant: 'm12_day' },
      { employeeId: 'e1', day: 0, shift: 'noon', roleId: GUARD, is12h: true, variant: 'm12_day' },
    ]
    expect(satisfiedCount(inp, 'e1', a)).toBe(2)
  })

  it('12h NOT covering the requested window does not count', () => {
    const inp = inputWithPrefs({ 0: ['morning'] })
    const a: Assignment[] = [
      { employeeId: 'e1', day: 0, shift: 'night', roleId: GUARD, is12h: true, variant: 'm12_night' },
    ]
    expect(satisfiedCount(inp, 'e1', a)).toBe(0)
  })
})

describe('engine end-to-end — stats.requestsSatisfied includes 12h coverage', () => {
  it('a lone guard requesting morning, staffed via forced 12h day coverage, is counted', () => {
    // 1 guard; morning+noon required on day 0; allow 12h. The engine can only
    // cover both windows with a single m12_day (one shift/day blocks two 8h).
    const employees = [emp('g1')]
    const requests = buildRequests(employees, (_id, d) => (d === 0 ? { preferred: ['morning'] } : {}))
    const res = generateSchedule(
      input({
        employees,
        requests,
        requirements: {
          0: { morning: { [GUARD]: 1 }, noon: { [GUARD]: 1 }, night: {} },
        },
        settings: { minRestHours: 8, idealRestHours: 16, allow12hFallback: true },
      }),
    )
    expect(res.twelveHourAssignments).toHaveLength(1)
    expect(res.stats.g1.requestsSatisfied).toBe(1)
  })
})
