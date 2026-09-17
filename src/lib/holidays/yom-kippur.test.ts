import { describe, it, expect } from 'vitest'
import { yomKippurWindow } from './yom-kippur'

/** Exact instants are the regression anchor for the whole Kippur pay feature:
 *  a hebcal minor bump that shifts candle lighting by a minute must fail here,
 *  not silently change someone's pay. */
describe('yomKippurWindow', () => {
  it('2026: Erev 20/09 18:22 → 21/09 19:15 Israel time', () => {
    expect(yomKippurWindow(2026)).toEqual({
      date: '2026-09-21',
      startMs: Date.parse('2026-09-20T15:22:00.000Z'),
      endMs: Date.parse('2026-09-21T16:15:00.000Z'),
    })
  })

  it('2028: Yom Kippur on Shabbat resolves to one candle lighting on the Friday', () => {
    expect(yomKippurWindow(2028)).toEqual({
      date: '2028-09-30',
      startMs: Date.parse('2028-09-29T15:09:00.000Z'),
      endMs: Date.parse('2028-09-30T16:03:00.000Z'),
    })
  })

  it('2025: falls in October — nothing hard-codes September', () => {
    const w = yomKippurWindow(2025)
    expect(w?.date).toBe('2025-10-02')
    expect(w?.startMs).toBe(Date.parse('2025-10-01T15:07:00.000Z'))
    expect(w?.endMs).toBe(Date.parse('2025-10-02T16:01:00.000Z'))
  })

  it('every year 2025–2035 yields a ~25h window', () => {
    for (let y = 2025; y <= 2035; y++) {
      const w = yomKippurWindow(y)
      expect(w, `year ${y}`).not.toBeNull()
      const hours = (w!.endMs - w!.startMs) / 3_600_000
      expect(hours, `year ${y}`).toBeGreaterThan(24)
      expect(hours, `year ${y}`).toBeLessThan(26)
    }
  })

  it('is memoised without corrupting the result', () => {
    expect(yomKippurWindow(2026)).toEqual(yomKippurWindow(2026))
  })
})
