import { describe, it, expect } from 'vitest'
import { diagnoseGap } from './diagnose'
import { generateSchedule } from './engine'
import { GUARD, SHIFT_MGR, emp, input, reqFor, buildRequests } from './fixtures'
import type { Assignment } from './types'

function committed(map: Record<string, Array<{ day: number; shift: Assignment['shift']; roleId: string }>>): Map<string, Assignment[]> {
  const out = new Map<string, Assignment[]>()
  for (const [id, list] of Object.entries(map)) out.set(id, list.map((a) => ({ employeeId: id, ...a })))
  return out
}

describe('diagnoseGap', () => {
  it('no_role — nobody holds the required role', () => {
    const inp = input({ employees: [emp('g1')], requirements: reqFor([0], 'morning', SHIFT_MGR, 1) })
    expect(diagnoseGap(inp, new Map(), 0, 'morning', SHIFT_MGR).reason).toBe('no_role')
  })

  it('available — a free holder can be placed directly', () => {
    const inp = input({ employees: [emp('g1')], requirements: reqFor([0], 'morning', GUARD, 1) })
    const r = diagnoseGap(inp, new Map(), 0, 'morning', GUARD)
    expect(r.reason).toBe('available')
    expect(r.askCandidates).toEqual([{ employeeId: 'g1', reason: 'available' }])
  })

  it('off — a soft-off holder can be asked to waive it', () => {
    const employees = [emp('g1')]
    const requests = buildRequests(employees, (_id, d) => (d === 0 ? { off: true } : {}))
    const inp = input({ employees, requirements: reqFor([0], 'morning', GUARD, 1), requests })
    const r = diagnoseGap(inp, new Map(), 0, 'morning', GUARD)
    expect(r.reason).toBe('off')
    expect(r.askCandidates).toEqual([{ employeeId: 'g1', reason: 'soft_off' }])
  })

  it('assigned_elsewhere — the only holder already works that day', () => {
    const inp = input({ employees: [emp('g1')], requirements: reqFor([0], 'noon', GUARD, 1) })
    const c = committed({ g1: [{ day: 0, shift: 'morning', roleId: GUARD }] })
    const r = diagnoseGap(inp, c, 0, 'noon', GUARD)
    expect(r.reason).toBe('assigned_elsewhere')
    expect(r.askCandidates).toHaveLength(0)
  })

  it('at_max — the only holder is already at their weekly max', () => {
    const inp = input({ employees: [emp('g1', { maxShifts: 1 })], requirements: reqFor([0], 'morning', GUARD, 1) })
    const c = committed({ g1: [{ day: 2, shift: 'morning', roleId: GUARD }] })
    expect(diagnoseGap(inp, c, 0, 'morning', GUARD).reason).toBe('at_max')
  })
})

describe('collectWarnings attaches a diagnosis', () => {
  it('an unstaffable role surfaces reason no_role on the warning', () => {
    const res = generateSchedule(input({ employees: [emp('g1')], requirements: reqFor([0], 'morning', SHIFT_MGR, 1) }))
    expect(res.warnings).toHaveLength(1)
    expect(res.warnings[0].reason).toBe('no_role')
  })
})
