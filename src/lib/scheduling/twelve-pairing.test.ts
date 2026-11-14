// A 07:00–19:00 shift only really covers the noon cell when someone relieves it
// at 19:00. These tests pin the pairing step of the 12h pass: an 8h night
// worker is upgraded to 19:00–07:00 to complete the pair, and a day shift that
// cannot be relieved is not allowed to report the noon cell as covered.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, DISPATCH, SHIFT_MGR, buildRequests, emp, input, mergeReqs, reqFor, settings } from './fixtures'
import type { EngineResult, ShiftKey } from './types'

const on = () => settings({ allow12hFallback: true })
const ROLES = [SHIFT_MGR, DISPATCH, GUARD]
/** One of each role on every shift of day 0. */
const fullDay = mergeReqs(
  ...(['morning', 'noon', 'night'] as ShiftKey[]).flatMap((s) => ROLES.map((r) => reqFor([0], s, r, 1))),
)

const variants = (res: EngineResult, v: string) => res.twelveHourAssignments.filter((t) => t.variant === v)
/** People physically on site 19:00–23:00: 8h noon workers and 19:00–07:00 workers. */
function onSiteEvening(res: EngineResult, day: number): number {
  const twelve = new Set(res.twelveHourAssignments.filter((t) => t.day === day).map((t) => t.employeeId))
  const eightHourNoon = Object.values(res.grid[day].noon).flat().filter((id) => !twelve.has(id)).length
  return eightHourNoon + variants(res, 'm12_night').filter((t) => t.day === day).length
}

describe('12h pairing', () => {
  it("the owner's Sunday: 2 morning + 1 noon + 3 night workers become three day/night pairs", () => {
    const staff = [
      emp('m1', { roleIds: [SHIFT_MGR] }), emp('m2', { roleIds: [DISPATCH] }), emp('n1', { roleIds: [GUARD] }),
      emp('x1', { roleIds: [SHIFT_MGR] }), emp('x2', { roleIds: [DISPATCH] }), emp('x3', { roleIds: [GUARD] }),
    ]
    const want: Record<string, ShiftKey> = { m1: 'morning', m2: 'morning', n1: 'noon', x1: 'night', x2: 'night', x3: 'night' }
    const res = generateSchedule(input({
      employees: staff, requirements: fullDay, settings: on(),
      requests: buildRequests(staff, (id, day) => (day === 0 ? { preferred: [want[id]] } : {})),
    }))
    expect(res.coverage.filledSlots).toBe(9)
    expect(variants(res, 'm12_day').map((t) => t.employeeId).sort()).toEqual(['m1', 'm2', 'n1'])
    expect(variants(res, 'm12_night').map((t) => t.employeeId).sort()).toEqual(['x1', 'x2', 'x3'])
    expect(onSiteEvening(res, 0)).toBe(3)
  })

  it('every 07:00–19:00 shift counted toward noon has a 19:00–07:00 partner who holds that role', () => {
    const staff = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => emp(id, { roleIds: ROLES }))
    const res = generateSchedule(input({ employees: staff, requirements: fullDay, settings: on() }))
    expect(res.coverage.filledSlots).toBe(9)
    expect(onSiteEvening(res, 0)).toBe(3)
  })

  it('upgrading a night worker keeps them in their night role and adds no shift', () => {
    const staff = [
      emp('m1', { roleIds: [GUARD] }), emp('x1', { roleIds: [GUARD] }),
    ]
    const req = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'noon', GUARD, 1), reqFor([0], 'night', GUARD, 1))
    const res = generateSchedule(input({
      employees: staff, requirements: req, settings: on(),
      requests: buildRequests(staff, (id, day) => (day === 0 ? { preferred: [id === 'm1' ? 'morning' : 'night'] } : {})),
    }))
    expect(res.grid[0].night[GUARD]).toEqual(['x1'])
    expect(variants(res, 'm12_night')).toEqual([{ employeeId: 'x1', day: 0, variant: 'm12_night', rolesByShift: { night: GUARD } }])
    expect(res.assignmentsByEmployee.x1.filter((a) => a.day === 0)).toHaveLength(1)
  })

  it('a day shift nobody can relieve does not count the noon cell as covered', () => {
    // x1 may work nights only, so 19:00–07:00 (which starts in the noon window)
    // is not allowed for them, and there is nobody else.
    const staff = [
      emp('m1', { roleIds: [GUARD] }),
      emp('x1', { roleIds: [GUARD], availability: { 0: ['night'] } }),
    ]
    const req = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'noon', GUARD, 1), reqFor([0], 'night', GUARD, 1))
    const res = generateSchedule(input({ employees: staff, requirements: req, settings: on() }))
    expect(variants(res, 'm12_day')).toEqual([])
    expect(res.grid[0].noon[GUARD]).toEqual([])
    expect(res.coverage.filledSlots).toBe(2)
    expect(res.warnings.some((w) => w.day === 0 && w.shift === 'noon')).toBe(true)
    expect(res.feasibility.status).not.toBe('ok')
  })
})
