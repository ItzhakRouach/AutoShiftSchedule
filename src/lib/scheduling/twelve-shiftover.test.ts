// When a night cell is open and nobody is free for it, the day can still be
// closed without an extra person: the noon worker moves to 19:00–07:00 and the
// morning worker stays on until 19:00 to cover the gap between them. This is
// the owner's own fix (a lone noon worker "moved over" to make the pairs).
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, SHIFT_MGR, buildRequests, emp, input, mergeReqs, reqFor, settings } from './fixtures'
import type { ShiftKey } from './types'

const on = () => settings({ allow12hFallback: true })
const oneRole = (role: string) =>
  mergeReqs(...(['morning', 'noon', 'night'] as ShiftKey[]).map((s) => reqFor([0], s, role, 1)))

describe('shift-over into a day/night pair', () => {
  it('morning + noon workers, empty night → 07:00–19:00 + 19:00–07:00, no extra person', () => {
    const staff = [emp('m', { roleIds: [SHIFT_MGR] }), emp('n', { roleIds: [SHIFT_MGR] })]
    const res = generateSchedule(input({
      employees: staff, requirements: oneRole(SHIFT_MGR), settings: on(),
      requests: buildRequests(staff, (id, d) => (d === 0 ? { preferred: [id === 'm' ? 'morning' : 'noon'] } : {})),
    }))
    expect(res.coverage.filledSlots).toBe(3)
    expect(res.twelveHourAssignments.map((t) => `${t.employeeId}:${t.variant}`).sort()).toEqual(['m:m12_day', 'n:m12_night'])
    expect(res.grid[0].night[SHIFT_MGR]).toEqual(['n'])
  })

  it('cross-role: the noon worker covers the night role, the morning worker takes over noon', () => {
    // m (guard) works the morning guard cell; n holds both roles and works the
    // noon guard cell; the night needs a shift manager nobody else can be.
    const m = emp('m', { roleIds: [GUARD] })
    const n = emp('n', { roleIds: [SHIFT_MGR, GUARD] })
    const req = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'noon', GUARD, 1), reqFor([0], 'night', SHIFT_MGR, 1))
    const res = generateSchedule(input({
      employees: [m, n], requirements: req, settings: on(),
      requests: buildRequests([m, n], (id, d) => (d === 0 ? { preferred: [id === 'm' ? 'morning' : 'noon'] } : {})),
    }))
    expect(res.coverage.filledSlots).toBe(3)
    expect(res.grid[0].noon[GUARD]).toEqual(['m'])
    expect(res.grid[0].night[SHIFT_MGR]).toEqual(['n'])
  })

  it('does not move the noon worker when the morning worker cannot stay until 19:00', () => {
    const m = emp('m', { roleIds: [SHIFT_MGR], availability: { 0: ['morning'] } })
    const n = emp('n', { roleIds: [SHIFT_MGR] })
    const res = generateSchedule(input({
      employees: [m, n], requirements: oneRole(SHIFT_MGR), settings: on(),
      requests: buildRequests([m, n], (id, d) => (d === 0 ? { preferred: [id === 'm' ? 'morning' : 'noon'] } : {})),
    }))
    expect(res.coverage.filledSlots).toBe(2)
    expect(res.grid[0].noon[SHIFT_MGR]).toEqual(['n'])
    expect(res.twelveHourAssignments).toEqual([])
  })
})
