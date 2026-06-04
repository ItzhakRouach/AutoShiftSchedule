import { describe, it, expect } from 'vitest'
import type { Assignment } from './types'
import { fairnessScore } from './fairness'

const noShifts: Assignment[] = []
const oneMorning: Assignment[] = [{ employeeId: 'a', day: 0, shift: 'morning', roleId: 'r' }]

describe('fairnessScore with priorExtras', () => {
  it('defaults priorExtras to 0 and matches the load-only score', () => {
    expect(fairnessScore(noShifts)).toBe(fairnessScore(noShifts, 0))
  })
  it('a higher priorExtras strictly raises the score (lower priority)', () => {
    expect(fairnessScore(noShifts, 1)).toBeGreaterThan(fairnessScore(noShifts, 0))
    expect(fairnessScore(noShifts, 2)).toBeGreaterThan(fairnessScore(noShifts, 1))
  })
  it('priorExtras dominates load: 1 extra last week outranks 1 shift this week', () => {
    // Candidate A: no current shifts, +1 priorExtras.
    // Candidate B: 1 current shift, 0 priorExtras.
    // We want B to be preferred (lower score), i.e. A's score > B's score.
    const a = fairnessScore(noShifts, 1)
    const b = fairnessScore(oneMorning, 0)
    expect(a).toBeGreaterThan(b)
  })
})
