import { describe, it, expect } from 'vitest'
import { restPenalty, nightCount, nightOverage } from './fairness'
import type { Assignment, ShiftKey } from './types'

const a = (day: number, shift: ShiftKey): Assignment => ({
  employeeId: 'e',
  day,
  shift,
  roleId: 'r',
})

describe('restPenalty', () => {
  it('is 0 for fewer than two shifts', () => {
    expect(restPenalty([], 16)).toBe(0)
    expect(restPenalty([a(0, 'morning')], 16)).toBe(0)
  })

  it('is 0 when every turnaround is at least ideal', () => {
    // morning day0 (07–15) → morning day1 (07–15): gap 16h.
    expect(restPenalty([a(0, 'morning'), a(1, 'morning')], 16)).toBe(0)
  })

  it('penalises a tight night→next-day-noon turnaround (8h gap)', () => {
    // night day0 ends 07:00 day1; noon day1 starts 15:00 → 8h gap → 16−8 = 8.
    expect(restPenalty([a(0, 'night'), a(1, 'noon')], 16)).toBe(8)
  })

  it('accumulates penalty across an 8-8-8 rotation', () => {
    // night d0 → noon d1 (8h) → ... build a chain of tight gaps.
    const chain = [a(0, 'night'), a(1, 'noon'), a(2, 'morning')]
    // noon d1 (15–23) → morning d2 (07–15 d2): gap = 31+? compute: noon end 23:00 d1
    // = abs 47; morning d2 start = abs 55 → gap 8h. So two 8h gaps → 8 + 8 = 16.
    expect(restPenalty(chain, 16)).toBe(16)
  })

  it('respects a lower ideal threshold', () => {
    expect(restPenalty([a(0, 'night'), a(1, 'noon')], 8)).toBe(0)
  })
})

describe('night counting', () => {
  it('counts nights', () => {
    expect(nightCount([a(0, 'night'), a(1, 'noon'), a(2, 'night')])).toBe(2)
  })

  it('reports overage beyond the threshold', () => {
    const four = [a(0, 'night'), a(1, 'night'), a(2, 'night'), a(3, 'night')]
    expect(nightOverage(four, 3)).toBe(1)
    expect(nightOverage(four, 4)).toBe(0)
  })

  it('exempts non-finite thresholds (night-only workers)', () => {
    const five = Array.from({ length: 5 }, (_, i) => a(i, 'night'))
    expect(nightOverage(five, Infinity)).toBe(0)
  })
})
