import { describe, it, expect } from 'vitest'
import { mulberry32, shuffle, draw } from './lottery'

describe('seeded PRNG', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = [a(), a(), a()]
    const seqB = [b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })
  it('different seeds give different sequences', () => {
    const a = mulberry32(1)()
    const b = mulberry32(2)()
    expect(a).not.toEqual(b)
  })
  it('returns floats in [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 100; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('shuffle / draw determinism', () => {
  it('same seed → identical shuffle', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    expect(shuffle(items, mulberry32(99))).toEqual(shuffle(items, mulberry32(99)))
  })
  it('does not mutate the input', () => {
    const items = ['a', 'b', 'c']
    shuffle(items, mulberry32(3))
    expect(items).toEqual(['a', 'b', 'c'])
  })
  it('draw picks `count` deterministic winners', () => {
    const items = ['a', 'b', 'c', 'd']
    const w1 = draw(items, 2, mulberry32(5))
    const w2 = draw(items, 2, mulberry32(5))
    expect(w1).toEqual(w2)
    expect(w1).toHaveLength(2)
  })
  it('draw returns all when count >= length', () => {
    expect(draw(['a', 'b'], 5, mulberry32(1))).toEqual(['a', 'b'])
  })
})
