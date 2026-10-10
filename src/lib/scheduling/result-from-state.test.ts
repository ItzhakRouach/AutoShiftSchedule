// `resultFromFillState` is the shared tail of generateSchedule: it turns a
// committed FillState into a full EngineResult (warnings, gap reasons,
// feasibility, coverage, stats, night imbalance, 12h suggestions). The AI
// second-opinion path needs it so an AI-produced schedule yields the exact same
// result shape — and therefore renders and persists through the same code.
import { describe, it, expect } from 'vitest'
import { generateSchedule, resultFromFillState } from './engine'
import { runFillHardDaysAware } from './fill'
import { emp, input, reqFor, mergeReqs, GUARD, SHIFT_MGR } from './fixtures'

const week = () =>
  input({
    employees: [
      emp('a', { roleIds: [GUARD, SHIFT_MGR], minShifts: 3 }),
      emp('b', { roleIds: [GUARD], minShifts: 3 }),
    ],
    requirements: mergeReqs(
      reqFor([0, 1, 2], 'morning', GUARD, 1),
      reqFor([0, 1], 'night', GUARD, 1),
      reqFor([3], 'morning', SHIFT_MGR, 1),
    ),
  })

describe('resultFromFillState', () => {
  it('reproduces generateSchedule exactly for the same fill', () => {
    const inp = week()
    const direct = generateSchedule(inp)
    const viaState = resultFromFillState(inp, runFillHardDaysAware(inp, inp.skipTwelve ?? false))
    expect(viaState).toEqual(direct)
  })

  it('computes warnings and coverage from the state it is handed', () => {
    const inp = input({
      employees: [emp('a', { roleIds: [GUARD] })],
      requirements: reqFor([0], 'night', SHIFT_MGR, 1), // nobody holds אחמ״ש
    })
    const res = resultFromFillState(inp, runFillHardDaysAware(inp))
    expect(res.coverage).toEqual({ requiredSlots: 1, filledSlots: 0, percent: 0 })
    expect(res.warnings).toHaveLength(1)
    expect(res.warnings[0].reason).toBe('no_role')
  })

  it('derives stats, night imbalance and 12h suggestions from the state', () => {
    const inp = week()
    const res = resultFromFillState(inp, runFillHardDaysAware(inp))
    expect(Object.keys(res.stats).sort()).toEqual(['a', 'b'])
    expect(Array.isArray(res.nightImbalance)).toBe(true)
    expect(Array.isArray(res.twelveHourSuggestions)).toBe(true)
  })
})
