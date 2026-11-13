import { describe, it, expect } from 'vitest'
import { balanceLine, isAboveAverage } from './balance-text'

const counts = (night = 0, m12_night = 0) => ({ morning: 0, noon: 0, night, m12_day: 0, m12_night })

describe('balanceLine', () => {
  it('reads naturally for zero, one and many shifts', () => {
    expect(balanceLine({ total: 0, counts: counts(), asked: 0, got: 0 })).toBe('אין משמרות השבוע')
    expect(balanceLine({ total: 1, counts: counts(), asked: 0, got: 0 })).toBe('משמרת אחת השבוע')
    expect(balanceLine({ total: 4, counts: counts(), asked: 0, got: 0 })).toBe('4 משמרות השבוע')
  })

  it('adds nights (12h nights included) and requests only when there are any', () => {
    expect(balanceLine({ total: 4, counts: counts(1), asked: 3, got: 1 })).toBe('4 משמרות השבוע · לילה אחד · בקשות: 1 מתוך 3')
    expect(balanceLine({ total: 5, counts: counts(1, 1), asked: 0, got: 0 })).toBe('5 משמרות השבוע · 2 לילות')
  })
})

describe('isAboveAverage', () => {
  const rows = [{ total: 4 }, { total: 4 }, { total: 6 }, { total: 2 }] // avg 4
  it('flags a worker at least one full shift over the average', () => {
    expect(isAboveAverage(6, rows)).toBe(true)
    expect(isAboveAverage(5, rows)).toBe(true)
    expect(isAboveAverage(4, rows)).toBe(false)
  })
  it('is false on an empty roster', () => expect(isAboveAverage(3, [])).toBe(false))
})
