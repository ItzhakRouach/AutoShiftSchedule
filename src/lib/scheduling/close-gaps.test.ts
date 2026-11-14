// Gaps left after the 8h fill are closed with 12h day/night pairs first; a
// worker's requested day off is overridden only when that still leaves a cell
// open (owner decision 2026-11-14) — but never at the cost of coverage.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, buildRequests, emp, input, mergeReqs, reqFor, settings } from './fixtures'
import type { ShiftKey } from './types'

const on = () => settings({ allow12hFallback: true })
const fullDay = mergeReqs(...(['morning', 'noon', 'night'] as ShiftKey[]).map((s) => reqFor([0], s, GUARD, 1)))

describe('closing gaps: 12h before day-off overrides', () => {
  it('two workers on, one asked off → a day/night pair, the day off is respected', () => {
    const staff = [emp('a'), emp('b'), emp('c')]
    const res = generateSchedule(input({
      employees: staff, requirements: fullDay, settings: on(),
      requests: buildRequests(staff, (id, d) => (d === 0 && id === 'c' ? { off: true } : {})),
    }))
    expect(res.coverage.filledSlots).toBe(3)
    expect(res.overriddenOff).toEqual([])
    expect(res.twelveHourAssignments.map((t) => t.variant).sort()).toEqual(['m12_day', 'm12_night'])
  })

  it('when 12h cannot close the gap, the day off is overridden', () => {
    // b may only work nights, so no 07:00–19:00 / 19:00–07:00 pair is possible:
    // the only way to staff all three cells is to bring c in on their day off.
    const staff = [emp('a'), emp('b', { availability: { 0: ['night'] } }), emp('c')]
    const res = generateSchedule(input({
      employees: staff, requirements: fullDay, settings: on(),
      requests: buildRequests(staff, (id, d) => (d === 0 && id === 'c' ? { off: true } : {})),
    }))
    expect(res.coverage.filledSlots).toBe(3)
    expect(res.overriddenOff.map((o) => o.employeeId)).toEqual(['c'])
  })
})
