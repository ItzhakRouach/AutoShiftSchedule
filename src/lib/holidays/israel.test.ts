import { describe, it, expect } from 'vitest'
import { israeliChagDates } from './israel'

describe('israeliChagDates', () => {
  it('returns Yom Kippur for 2024 on the correct date', () => {
    const chagim = israeliChagDates(2024)
    const yk = chagim.find((c) => c.name.includes('כִּפּוּר'))
    expect(yk).toBeDefined()
    expect(yk!.date).toBe('2024-10-12')
  })

  it('returns Rosh Hashana (2 days) for 2024', () => {
    const chagim = israeliChagDates(2024)
    const rh = chagim.filter((c) => c.name.includes('רֹאשׁ הַשָּׁנָה'))
    expect(rh).toHaveLength(2)
    expect(rh[0].date).toBe('2024-10-03')
    expect(rh[1].date).toBe('2024-10-04')
  })

  it('returns exactly the 8 melacha-forbidden chagim for 2024', () => {
    const chagim = israeliChagDates(2024)
    // Israel: Pesach I, Pesach VII, Shavuot, RH x2, YK, Sukkot I, Shmini Atzeret
    expect(chagim).toHaveLength(8)
  })

  it('returns Pesach I and Pesach VII for 2025 with correct dates', () => {
    const chagim = israeliChagDates(2025)
    const pesach = chagim.filter((c) => c.name.includes('פֶּסַח'))
    expect(pesach).toHaveLength(2)
    expect(pesach[0].date).toBe('2025-04-13')
    expect(pesach[1].date).toBe('2025-04-19')
  })

  it('results are sorted ascending by date', () => {
    const chagim = israeliChagDates(2025)
    for (let i = 1; i < chagim.length; i++) {
      expect(chagim[i].date >= chagim[i - 1].date).toBe(true)
    }
  })

  it('each entry has a YYYY-MM-DD date and a non-empty name', () => {
    const chagim = israeliChagDates(2024)
    for (const c of chagim) {
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(c.name.length).toBeGreaterThan(0)
    }
  })
})
