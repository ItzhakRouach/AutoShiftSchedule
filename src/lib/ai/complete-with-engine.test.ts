// The AI's accepted rows are a SEED, not a finished schedule. Whatever it left
// open (or we rejected) is closed by the engine's own fill, so the result is
// always complete and legal regardless of what the model did.
import { describe, it, expect } from 'vitest'
import { completeWithEngine } from './complete-with-engine'
import { validateProposal } from './validate-proposal'
import { buildKeyMaps } from './keys'
import { generateSchedule, validateAssignment } from '@/lib/scheduling'
import { emp, input, reqFor, mergeReqs, settings, GUARD } from '@/lib/scheduling/fixtures'
import type { EngineInput } from '@/lib/scheduling/types'

const K = (i: EngineInput) => buildKeyMaps(i)

const week = () =>
  input({
    employees: ['u1', 'u2', 'u3'].map((id) => emp(id, { roleIds: [GUARD] })),
    requirements: mergeReqs(
      reqFor([0, 1, 2, 3], 'morning', GUARD, 1),
      reqFor([0, 1, 2, 3], 'night', GUARD, 1),
    ),
  })

describe('completeWithEngine', () => {
  it('fills everything the AI left open', () => {
    const i = week()
    const g = K(i).roleKey(GUARD)!
    // The AI only placed ONE of the eight required slots.
    const v = validateProposal(i, { assignments: [{ emp: 'e0', day: 0, shift: 'M', role: g }] })
    expect(v.accepted).toBe(1)
    const res = completeWithEngine(i, v.state)
    expect(res.coverage.filledSlots).toBe(res.coverage.requiredSlots)
  })

  it('keeps the AI rows it was seeded with', () => {
    const i = week()
    const g = K(i).roleKey(GUARD)!
    const v = validateProposal(i, { assignments: [{ emp: 'e2', day: 3, shift: 'N', role: g }] })
    const res = completeWithEngine(i, v.state)
    const u3 = res.assignmentsByEmployee['u3'] ?? []
    expect(u3.some((a) => a.day === 3 && a.shift === 'night')).toBe(true)
  })

  it('produces a result with no hard-constraint violations', () => {
    const i = week()
    const g = K(i).roleKey(GUARD)!
    const v = validateProposal(i, {
      assignments: [
        { emp: 'e0', day: 0, shift: 'M', role: g },
        { emp: 'e1', day: 1, shift: 'N', role: g },
      ],
    })
    const res = completeWithEngine(i, v.state)
    // Re-validate the whole produced week: every row legal given the others.
    for (const [empId, rows] of Object.entries(res.assignmentsByEmployee)) {
      const e = i.employees.find((x) => x.id === empId)!
      for (const a of rows) {
        const others = rows.filter((x) => x !== a)
        const meta = i.days.find((d) => d.index === a.day)!
        expect(validateAssignment(i, e, meta, a.shift, a.roleId, others)).toBe(true)
      }
    }
  })

  it('runs the 12h fallback when 8h cannot cover and it is allowed', () => {
    const i = input({
      employees: [emp('u1', { roleIds: [GUARD] }), emp('u2', { roleIds: [GUARD] })],
      requirements: mergeReqs(
        reqFor([0], 'morning', GUARD, 1),
        reqFor([0], 'noon', GUARD, 1),
        reqFor([0], 'night', GUARD, 1),
      ),
      settings: settings({ allow12hFallback: true }),
    })
    const v = validateProposal(i, { assignments: [] })
    const res = completeWithEngine(i, v.state)
    expect(res.coverage.filledSlots).toBeGreaterThan(2)
  })

  it('leaves 12h alone when the workplace disallows it', () => {
    const i = input({
      employees: [emp('u1', { roleIds: [GUARD] })],
      requirements: mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'night', GUARD, 1)),
      settings: settings({ allow12hFallback: false }),
    })
    const res = completeWithEngine(i, validateProposal(i, { assignments: [] }).state)
    expect(res.twelveHourAssignments).toEqual([])
  })

  it('matches the pure engine when seeded with nothing', () => {
    const i = week()
    const seeded = completeWithEngine(i, validateProposal(i, { assignments: [] }).state)
    // Same coverage as the engine alone; the engine's own passes did the work.
    expect(seeded.coverage).toEqual(generateSchedule(i).coverage)
  })
})
