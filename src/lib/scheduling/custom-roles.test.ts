import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { emp, input, reqFor, mergeReqs } from './fixtures'

describe('configurable roles (data-driven grid)', () => {
  it('schedules a non-default custom role without crashing', () => {
    const CUSTOM = 'אב בית'
    const e = emp('e1', { roleIds: [CUSTOM] })
    const res = generateSchedule(
      input({ employees: [e], requirements: reqFor([0], 'morning', CUSTOM, 1), seed: 1 }),
    )
    expect(res.grid[0].morning[CUSTOM]).toEqual(['e1'])
    expect(res.coverage.percent).toBe(100)
  })

  it('handles four distinct roles in one shift', () => {
    const roles = ['טבח', 'מלצר', 'ברמן', 'מנהל']
    const employees = roles.map((r, i) => emp(`e${i}`, { roleIds: [r] }))
    const requirements = roles.reduce(
      (acc, r) => mergeReqs(acc, reqFor([0], 'morning', r, 1)),
      {} as ReturnType<typeof reqFor>,
    )
    const res = generateSchedule(input({ employees, requirements, seed: 1 }))
    for (const r of roles) {
      expect(res.grid[0].morning[r]).toHaveLength(1)
    }
    expect(res.coverage.percent).toBe(100)
  })
})
