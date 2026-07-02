// Task 5a: EngineInput.skipTwelve — 8h-first generation. `generateSchedule`
// must pass skipTwelve straight through to runFill so the primary "צור סידור
// אוטומטי" flow can request an 8h-ONLY fill while suggestions/warnings still
// reflect the real gaps (the manager decides on 12h via the secondary button).
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, emp, input, mergeReqs, reqFor, settings } from './fixtures'

const on = () => settings({ allow12hFallback: true })

describe('EngineInput.skipTwelve', () => {
  it('skipTwelve:true → no twelveHourAssignments, gaps reported as warnings', () => {
    // b can only close the night gap via a 12h (noon+night availability, no
    // one else eligible for night) — with skipTwelve the 12h pass never runs,
    // so night stays open and shows as a warning.
    const a = emp('a')
    const b = emp('b', { availability: { 0: ['noon', 'night'] } })
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'noon', GUARD, 1),
      reqFor([0], 'night', GUARD, 1),
    )
    const res = generateSchedule(
      input({ employees: [a, b], requirements: req, settings: on(), skipTwelve: true }),
    )
    expect(res.twelveHourAssignments).toEqual([])
    expect(res.warnings.some((w) => w.day === 0 && w.shift === 'night' && w.roleId === GUARD)).toBe(true)
  })

  it('skipTwelve:true still computes twelveHourSuggestions when allow12hFallback', () => {
    const a = emp('a')
    const b = emp('b', { availability: { 0: ['noon', 'night'] } })
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'noon', GUARD, 1),
      reqFor([0], 'night', GUARD, 1),
    )
    const res = generateSchedule(
      input({ employees: [a, b], requirements: req, settings: on(), skipTwelve: true }),
    )
    expect(res.twelveHourSuggestions.length).toBeGreaterThan(0)
  })

  it('skipTwelve:false (default/unset) behaves exactly as before (regression)', () => {
    const a = emp('a')
    const b = emp('b', { availability: { 0: ['noon', 'night'] } })
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'noon', GUARD, 1),
      reqFor([0], 'night', GUARD, 1),
    )
    const withFlagUnset = generateSchedule(input({ employees: [a, b], requirements: req, settings: on() }))
    const withFlagFalse = generateSchedule(
      input({ employees: [a, b], requirements: req, settings: on(), skipTwelve: false }),
    )
    expect(withFlagUnset.twelveHourAssignments.length).toBeGreaterThan(0)
    expect(withFlagFalse).toEqual(withFlagUnset)
  })

  it('8h layer determinism: skipTwelve run\'s non-is12h assignments equal a full run\'s, on a fixture without displacement', () => {
    // Fixture picked so tryDisplace never fires: two independent guards, each
    // with disjoint single-shift availability, one shift permanently
    // unstaffable (OTHER_ROLE nobody holds) so 8h fill has nothing to
    // displace/rearrange between the skipTwelve and full runs.
    const morningOnly = emp('m', { availability: { 0: ['morning'] } })
    const nightOnly = emp('n', { availability: { 0: ['night'] } })
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'night', GUARD, 1),
    )
    const full = generateSchedule(input({ employees: [morningOnly, nightOnly], requirements: req, settings: on(), seed: 5 }))
    const skip = generateSchedule(
      input({ employees: [morningOnly, nightOnly], requirements: req, settings: on(), seed: 5, skipTwelve: true }),
    )
    const eightLayer = (assignments: typeof full.assignmentsByEmployee) =>
      Object.fromEntries(
        Object.entries(assignments).map(([id, list]) => [id, list.filter((a) => !a.is12h)]),
      )
    expect(eightLayer(skip.assignmentsByEmployee)).toEqual(eightLayer(full.assignmentsByEmployee))
    expect(skip.twelveHourAssignments).toEqual([])
  })
})
