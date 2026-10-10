// THE safety gate. A model-produced schedule is untrusted input: it may
// double-book, break rest, put a Shabbat observer on Friday night, exceed a
// cap, over-fill a slot, or name someone who does not exist. Every one of those
// must be caught here, because whatever survives this is what gets persisted.
import { describe, it, expect } from 'vitest'
import { validateProposal } from './validate-proposal'
import { buildKeyMaps } from './keys'
import {
  emp, input, reqFor, mergeReqs, buildRequests, plainWeek, settings, GUARD, SHIFT_MGR,
} from '@/lib/scheduling/fixtures'
import type { EngineInput } from '@/lib/scheduling/types'

const K = (i: EngineInput) => buildKeyMaps(i)
const kinds = (v: { kind: string }[]) => v.map((x) => x.kind).sort()

describe('validateProposal — structural rejections', () => {
  const base = () =>
    input({
      employees: [emp('u1', { roleIds: [GUARD] }), emp('u2', { roleIds: [GUARD] })],
      requirements: mergeReqs(reqFor([0, 1], 'morning', GUARD, 1), reqFor([2], 'night', GUARD, 1)),
    })

  it('rejects an employee the model invented', () => {
    const i = base()
    const r = validateProposal(i, {
      assignments: [{ emp: 'e99', day: 0, shift: 'M', role: K(i).roleKey(GUARD)! }],
    })
    expect(kinds(r.violations)).toEqual(['unknown_employee'])
    expect(r.accepted).toBe(0)
  })

  it('rejects a role the model invented', () => {
    const i = base()
    const r = validateProposal(i, { assignments: [{ emp: 'e0', day: 0, shift: 'M', role: 'R42' }] })
    expect(kinds(r.violations)).toEqual(['unknown_role'])
  })

  it('rejects a slot that is not in the staffing requirements', () => {
    const i = base()
    const r = validateProposal(i, {
      assignments: [{ emp: 'e0', day: 4, shift: 'A', role: K(i).roleKey(GUARD)! }],
    })
    expect(kinds(r.violations)).toEqual(['no_such_requirement'])
  })

  it('rejects a second person in a slot that needs only one', () => {
    const i = base()
    const g = K(i).roleKey(GUARD)!
    const r = validateProposal(i, {
      assignments: [
        { emp: 'e0', day: 0, shift: 'M', role: g },
        { emp: 'e1', day: 0, shift: 'M', role: g },
      ],
    })
    expect(r.violations.map((v) => v.kind)).toContain('slot_over_capacity')
    expect(r.accepted).toBe(1) // the first survives, the extra is dropped
  })

  it('rejects the same employee twice on one day', () => {
    const i = input({
      employees: [emp('u1', { roleIds: [GUARD] })],
      requirements: mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'noon', GUARD, 1)),
    })
    const g = K(i).roleKey(GUARD)!
    const r = validateProposal(i, {
      assignments: [
        { emp: 'e0', day: 0, shift: 'M', role: g },
        { emp: 'e0', day: 0, shift: 'A', role: g },
      ],
    })
    expect(r.violations.map((v) => v.kind)).toContain('duplicate_day')
    expect(r.accepted).toBe(1)
  })
})

describe('validateProposal — hard constraint rejections', () => {
  it('rejects a role the employee does not hold', () => {
    const i = input({
      employees: [emp('u1', { roleIds: [GUARD] })],
      requirements: reqFor([0], 'morning', SHIFT_MGR, 1),
    })
    const r = validateProposal(i, {
      assignments: [{ emp: 'e0', day: 0, shift: 'M', role: K(i).roleKey(SHIFT_MGR)! }],
    })
    expect(kinds(r.violations)).toEqual(['role_not_held'])
  })

  it('rejects a Shabbat observer on Friday night', () => {
    const i = input({
      employees: [emp('u1', { roleIds: [GUARD], observesShabbat: true })],
      requirements: reqFor([5], 'night', GUARD, 1),
    })
    const r = validateProposal(i, {
      assignments: [{ emp: 'e0', day: 5, shift: 'N', role: K(i).roleKey(GUARD)! }],
    })
    expect(r.violations[0].kind).toBe('hard_constraint')
    expect(r.violations[0].reason).toBe('sacred')
    expect(r.accepted).toBe(0)
  })

  it('rejects a rest violation (night then next morning)', () => {
    const i = input({
      employees: [emp('u1', { roleIds: [GUARD] })],
      requirements: mergeReqs(reqFor([0], 'night', GUARD, 1), reqFor([1], 'morning', GUARD, 1)),
      settings: settings({ minRestHours: 8 }),
    })
    const g = K(i).roleKey(GUARD)!
    const r = validateProposal(i, {
      assignments: [
        { emp: 'e0', day: 0, shift: 'N', role: g },
        { emp: 'e0', day: 1, shift: 'M', role: g },
      ],
    })
    expect(r.violations.map((v) => v.reason)).toContain('rest')
  })

  it('rejects going over maxShifts', () => {
    const i = input({
      employees: [emp('u1', { roleIds: [GUARD], maxShifts: 1 })],
      requirements: mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([3], 'morning', GUARD, 1)),
    })
    const g = K(i).roleKey(GUARD)!
    const r = validateProposal(i, {
      assignments: [
        { emp: 'e0', day: 0, shift: 'M', role: g },
        { emp: 'e0', day: 3, shift: 'M', role: g },
      ],
    })
    expect(r.violations.map((v) => v.reason)).toContain('at_max')
  })

  it('rejects an assignment on a hard off-request', () => {
    const employees = [emp('u1', { roleIds: [GUARD] })]
    const i = input({
      employees,
      requirements: reqFor([2], 'morning', GUARD, 1),
      requests: buildRequests(employees, (_id, day) => (day === 2 ? { offHard: true } : {})),
    })
    const r = validateProposal(i, {
      assignments: [{ emp: 'e0', day: 2, shift: 'M', role: K(i).roleKey(GUARD)! }],
    })
    expect(r.violations[0].reason).toBe('off')
  })
})

describe('validateProposal — a clean proposal', () => {
  it('accepts a fully legal week and builds a usable FillState', () => {
    const i = input({
      employees: [emp('u1', { roleIds: [GUARD] }), emp('u2', { roleIds: [GUARD] })],
      requirements: mergeReqs(reqFor([0, 2, 4], 'morning', GUARD, 1), reqFor([1, 3], 'night', GUARD, 1)),
    })
    const g = K(i).roleKey(GUARD)!
    const r = validateProposal(i, {
      assignments: [
        { emp: 'e0', day: 0, shift: 'M', role: g },
        { emp: 'e0', day: 2, shift: 'M', role: g },
        { emp: 'e0', day: 4, shift: 'M', role: g },
        { emp: 'e1', day: 1, shift: 'N', role: g },
        { emp: 'e1', day: 3, shift: 'N', role: g },
      ],
    })
    expect(r.violations).toEqual([])
    expect(r.accepted).toBe(5)
    expect(r.state.committed['u1']).toHaveLength(3)
    expect(r.state.grid[0].morning[GUARD]).toEqual(['u1'])
  })
})

describe('validateProposal — 12h blocks', () => {
  const twelveWeek = () =>
    input({
      employees: [emp('u1', { roleIds: [GUARD] }), emp('u2', { roleIds: [GUARD] })],
      requirements: mergeReqs(
        reqFor([0], 'morning', GUARD, 1),
        reqFor([0], 'noon', GUARD, 1),
        reqFor([0], 'night', GUARD, 1),
      ),
      days: plainWeek(),
      settings: settings({ allow12hFallback: true }),
    })

  it('accepts a legal m12_day and fills the windows it covers', () => {
    const i = twelveWeek()
    const g = K(i).roleKey(GUARD)!
    const r = validateProposal(i, {
      assignments: [],
      twelveHour: [{ emp: 'e0', day: 0, variant: 'm12_day', roles: { M: g, A: g } }],
    })
    expect(r.violations).toEqual([])
    expect(r.state.grid[0].morning[GUARD]).toEqual(['u1'])
    expect(r.state.grid[0].noon[GUARD]).toEqual(['u1'])
    expect(r.state.twelve).toHaveLength(1)
  })

  it('rejects a 12h whose covered window needs a role the employee lacks', () => {
    const i = input({
      employees: [emp('u1', { roleIds: [GUARD] })],
      requirements: mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'noon', SHIFT_MGR, 1)),
      settings: settings({ allow12hFallback: true }),
    })
    const r = validateProposal(i, {
      assignments: [],
      twelveHour: [
        {
          emp: 'e0', day: 0, variant: 'm12_day',
          roles: { M: K(i).roleKey(GUARD)!, A: K(i).roleKey(SHIFT_MGR)! },
        },
      ],
    })
    expect(r.violations.map((v) => v.kind)).toContain('twelve_role_not_held')
  })

  it('rejects a 12h for a Shabbat observer when a covered window is sacred', () => {
    const i = input({
      employees: [emp('u1', { roleIds: [GUARD], observesShabbat: true })],
      requirements: mergeReqs(reqFor([5], 'noon', GUARD, 1), reqFor([5], 'night', GUARD, 1)),
      settings: settings({ allow12hFallback: true }),
    })
    const g = K(i).roleKey(GUARD)!
    const r = validateProposal(i, {
      assignments: [],
      twelveHour: [{ emp: 'e0', day: 5, variant: 'm12_night', roles: { A: g, N: g } }],
    })
    expect(r.violations.map((v) => v.kind)).toContain('twelve_illegal')
  })

  it('rejects a 12h that collides with the same employee 8h that day', () => {
    const i = twelveWeek()
    const g = K(i).roleKey(GUARD)!
    const r = validateProposal(i, {
      assignments: [{ emp: 'e0', day: 0, shift: 'N', role: g }],
      twelveHour: [{ emp: 'e0', day: 0, variant: 'm12_day', roles: { M: g, A: g } }],
    })
    expect(r.violations.length).toBeGreaterThan(0)
  })
})
