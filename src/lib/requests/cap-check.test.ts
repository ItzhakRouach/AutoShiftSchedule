import { describe, it, expect } from 'vitest'
import { weeklyCapBlocks, weeklyCapMessage, perDayCapBlocks, perDayCapMessage } from './cap-check'

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
