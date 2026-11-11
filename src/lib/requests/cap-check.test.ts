import { describe, it, expect } from 'vitest'
import {
  weeklyCapBlocks, weeklyCapMessage, perDayCapBlocks, perDayCapMessage,
  countRequestDays, requestCapBlocks, requestCapMessage, capReachedExcludingActive,
} from './cap-check'

describe('weeklyCapBlocks', () => {
  it('never blocks when cap is null', () => {
    expect(weeklyCapBlocks(null, 0)).toBe(false)
    expect(weeklyCapBlocks(null, 6)).toBe(false)
  })

  it('never blocks when cap is undefined', () => {
    expect(weeklyCapBlocks(undefined, 0)).toBe(false)
    expect(weeklyCapBlocks(undefined, 6)).toBe(false)
  })

  it('never blocks when cap is 0', () => {
    expect(weeklyCapBlocks(0, 0)).toBe(false)
    expect(weeklyCapBlocks(0, 6)).toBe(false)
  })

  it('never blocks when cap is negative', () => {
    expect(weeklyCapBlocks(-1, 0)).toBe(false)
    expect(weeklyCapBlocks(-1, 6)).toBe(false)
  })

  it('cap 1: used 0 allows (false)', () => {
    expect(weeklyCapBlocks(1, 0)).toBe(false)
  })

  it('cap 1: used 1 blocks (true)', () => {
    expect(weeklyCapBlocks(1, 1)).toBe(true)
  })

  it('cap 7 boundary: used 6 allows the 7th day (false)', () => {
    expect(weeklyCapBlocks(7, 6)).toBe(false)
  })

  it('cap 7 boundary: used 7 blocks (true)', () => {
    expect(weeklyCapBlocks(7, 7)).toBe(true)
  })
})

describe('weeklyCapMessage', () => {
  it('returns the exact Hebrew message', () => {
    expect(weeklyCapMessage(1)).toBe('הגעת למקסימום ימי חופש לשבוע (1)')
  })
})

describe('perDayCapBlocks', () => {
  it('never blocks when cap is null, even with dayOffCount 0', () => {
    expect(perDayCapBlocks(null, 0)).toBe(false)
  })

  it('never blocks when cap is null, even with dayOffCount 5', () => {
    expect(perDayCapBlocks(null, 5)).toBe(false)
  })

  it('never blocks when cap is 0, even with dayOffCount 0', () => {
    expect(perDayCapBlocks(0, 0)).toBe(false)
  })

  it('never blocks when cap is 0, even with dayOffCount 5', () => {
    expect(perDayCapBlocks(0, 5)).toBe(false)
  })

  it('cap 2: count 1 allows (false)', () => {
    expect(perDayCapBlocks(2, 1)).toBe(false)
  })

  it('cap 2: count 2 blocks (true)', () => {
    expect(perDayCapBlocks(2, 2)).toBe(true)
  })

  it('cap 2: count 3 blocks (true)', () => {
    expect(perDayCapBlocks(2, 3)).toBe(true)
  })
})

describe('perDayCapMessage', () => {
  it('returns the exact Hebrew message', () => {
    expect(perDayCapMessage(3, 2)).toBe('כבר 3 עובדים ביקשו חופש ביום זה — המכסה היומית (2) מלאה')
  })
})

describe('countRequestDays', () => {
  it('returns 0 for no rows', () => {
    expect(countRequestDays([])).toBe(0)
  })

  it('counts an off-only row once', () => {
    expect(countRequestDays([{ is_off: true, preferred_shift_ids: [] }])).toBe(1)
  })

  it('counts a shift-only row once regardless of how many shifts', () => {
    expect(countRequestDays([{ is_off: false, preferred_shift_ids: ['a', 'b', 'c'] }])).toBe(1)
  })

  it('counts a mixed off+shift row once', () => {
    expect(countRequestDays([{ is_off: true, preferred_shift_ids: ['a'] }])).toBe(1)
  })

  it('ignores junk empty rows (not off, no shifts)', () => {
    expect(
      countRequestDays([
        { is_off: false, preferred_shift_ids: [] },
        { is_off: true, preferred_shift_ids: [] },
        { is_off: false, preferred_shift_ids: ['a'] },
      ]),
    ).toBe(2)
  })
})

describe('requestCapBlocks', () => {
  it('never blocks when the employee is unlimited, even over the cap', () => {
    expect(requestCapBlocks(3, true, 3)).toBe(false)
    expect(requestCapBlocks(3, true, 6)).toBe(false)
  })

  it('never blocks when cap is null / undefined / 0 / negative', () => {
    expect(requestCapBlocks(null, false, 6)).toBe(false)
    expect(requestCapBlocks(undefined, false, 6)).toBe(false)
    expect(requestCapBlocks(0, false, 6)).toBe(false)
    expect(requestCapBlocks(-2, false, 6)).toBe(false)
  })

  it('cap 3: used 2 allows the 3rd day (false)', () => {
    expect(requestCapBlocks(3, false, 2)).toBe(false)
  })

  it('cap 3: used 3 blocks a 4th day (true)', () => {
    expect(requestCapBlocks(3, false, 3)).toBe(true)
  })
})

describe('requestCapMessage', () => {
  it('returns the exact Hebrew message', () => {
    expect(requestCapMessage(3)).toBe('ניתן לבקש עד 3 ימים בשבוע — הגעת למקסימום')
  })
})

describe('capReachedExcludingActive', () => {
  it('false when no cap', () => {
    expect(capReachedExcludingActive(null, 5, false)).toBe(false)
  })

  it('cap 3, current 3, active day NOT counted → reached', () => {
    expect(capReachedExcludingActive(3, 3, false)).toBe(true)
  })

  it('cap 3, current 3, active day already counted → not reached (its save replaces itself)', () => {
    expect(capReachedExcludingActive(3, 3, true)).toBe(false)
  })

  it('cap 3, current 2, active not counted → not reached', () => {
    expect(capReachedExcludingActive(3, 2, false)).toBe(false)
  })
})
