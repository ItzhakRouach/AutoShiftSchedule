// FIX B: feasibility MUST equal the engine's actual fill. The banner can never
// contradict the grid: coverage.filledSlots == feasibility.maxStaffable, always.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { checkFeasibility } from './feasibility'
import { GUARD, DISPATCH, buildRequests, emp, input, mergeReqs, reqFor, settings } from './fixtures'

describe('FIX B — feasibility == actual fill invariant', () => {
  // Multi-role day: a can do GUARD or DISPATCH, b only GUARD. Need 1 of each.
  // The greedy per-day matcher used to under-count; the real fill staffs both.
  it('multi-role day → status ok, required 2, maxStaffable 2, shortBy 0', () => {
    const a = emp('a', { roleIds: [GUARD, DISPATCH] })
    const b = emp('b', { roleIds: [GUARD] })
    const req = mergeReqs(reqFor([0], 'morning', GUARD, 1), reqFor([0], 'morning', DISPATCH, 1))
    const eng = generateSchedule(input({ employees: [a, b], requirements: req }))
    const f = eng.feasibility
    expect(f.status).toBe('ok')
    expect(f.requiredSlots).toBe(2)
    expect(f.maxStaffable).toBe(2)
    expect(f.shortBy).toBe(0)
    expect(eng.coverage.filledSlots).toBe(f.maxStaffable)
    // checkFeasibility standalone agrees.
    const standalone = checkFeasibility(input({ employees: [a, b], requirements: req }))
    expect(standalone.maxStaffable).toBe(2)
    expect(standalone.status).toBe('ok')
  })

  it('genuinely understaffed week → short/needs12h with correct shortBy and invariant', () => {
    const req = mergeReqs(
      reqFor([0], 'morning', GUARD, 1),
      reqFor([0], 'noon', GUARD, 1),
      reqFor([0], 'night', GUARD, 1),
    )
    const eng = generateSchedule(
      input({ employees: [emp('a')], requirements: req, settings: settings({ allow12hFallback: false }) }),
    )
    expect(eng.feasibility.status).toBe('short')
    expect(eng.feasibility.shortBy).toBe(2)
    expect(eng.coverage.filledSlots).toBe(eng.feasibility.maxStaffable)

    const eng12 = generateSchedule(
      input({ employees: [emp('a')], requirements: req, settings: settings({ allow12hFallback: true }) }),
    )
    expect(eng12.feasibility.status).toBe('needs12h')
    expect(eng12.feasibility.shortBy).toBe(2)
    expect(eng12.coverage.filledSlots).toBe(eng12.feasibility.maxStaffable)
  })

  // Fuzz: a few seeded random weeks. For every case the invariant must hold and
  // filledSlots must never exceed requiredSlots.
  it('fuzz: filledSlots <= requiredSlots and == maxStaffable for seeded weeks', () => {
    const shifts = ['morning', 'noon', 'night'] as const
    for (let seed = 1; seed <= 12; seed++) {
      let s = seed * 2654435761
      const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
      const n = 1 + Math.floor(rnd() * 5)
      const employees = Array.from({ length: n }, (_, i) =>
        emp(`e${i}`, {
          employmentType: rnd() < 0.5 ? 'full' : rnd() < 0.5 ? 'part' : 'student',
          minShifts: Math.floor(rnd() * 3),
          maxShifts: 3 + Math.floor(rnd() * 4),
        }),
      )
      const parts = []
      for (let d = 0; d < 7; d++) {
        for (const sh of shifts) {
          if (rnd() < 0.45) parts.push(reqFor([d], sh, GUARD, 1 + (rnd() < 0.3 ? 1 : 0)))
        }
      }
      const requirements = parts.length ? mergeReqs(...parts) : {}
      const requests = buildRequests(employees, () =>
        rnd() < 0.4 ? { preferred: [shifts[Math.floor(rnd() * 3)]] } : {},
      )
      const eng = generateSchedule(
        input({ employees, requirements, requests, seed, settings: settings({ allow12hFallback: rnd() < 0.5 }) }),
      )
      expect(eng.coverage.filledSlots).toBeLessThanOrEqual(eng.coverage.requiredSlots)
      expect(eng.coverage.filledSlots).toBe(eng.feasibility.maxStaffable)
    }
  })
})
