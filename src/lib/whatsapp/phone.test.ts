import { describe, it, expect } from 'vitest'
import {
  normalizeIsraeliPhone,
  isValidIsraeliPhone,
  toLocalIsraeliPhone,
  formatIsraeliPhoneLocal,
  splitLocalPhone,
  ISRAELI_MOBILE_PREFIXES,
} from './phone'

describe('normalizeIsraeliPhone', () => {
  it('normalizes a local mobile number (0XX...)', () => {
    expect(normalizeIsraeliPhone('0521234567')).toBe('972521234567')
  })

  it('handles dashes and spaces', () => {
    expect(normalizeIsraeliPhone('052-123-4567')).toBe('972521234567')
    expect(normalizeIsraeliPhone(' 052 123 4567 ')).toBe('972521234567')
  })

  it('handles +972 prefix', () => {
    expect(normalizeIsraeliPhone('+972521234567')).toBe('972521234567')
  })

  it('handles 972 prefix without plus', () => {
    expect(normalizeIsraeliPhone('972521234567')).toBe('972521234567')
  })

  it('handles +972 followed by a trunk 0', () => {
    expect(normalizeIsraeliPhone('+972 0 52 123 4567')).toBe('972521234567')
  })

  it('accepts a bare subscriber number (no trunk 0, no country code)', () => {
    expect(normalizeIsraeliPhone('521234567')).toBe('972521234567')
  })

  it('normalizes a landline (8-digit subscriber)', () => {
    expect(normalizeIsraeliPhone('03-1234567')).toBe('97231234567')
  })

  it('is idempotent on already-normalized input', () => {
    expect(normalizeIsraeliPhone('972521234567')).toBe('972521234567')
  })

  it('returns null for empty / nullish input', () => {
    expect(normalizeIsraeliPhone('')).toBeNull()
    expect(normalizeIsraeliPhone(null)).toBeNull()
    expect(normalizeIsraeliPhone(undefined)).toBeNull()
  })

  it('returns null for too-short numbers', () => {
    expect(normalizeIsraeliPhone('12345')).toBeNull()
    expect(normalizeIsraeliPhone('050123')).toBeNull()
  })

  it('returns null for too-long numbers', () => {
    expect(normalizeIsraeliPhone('05212345678901')).toBeNull()
  })

  it('returns null for non-digit garbage', () => {
    expect(normalizeIsraeliPhone('abc')).toBeNull()
  })
})

describe('isValidIsraeliPhone', () => {
  it('returns true for valid numbers', () => {
    expect(isValidIsraeliPhone('0521234567')).toBe(true)
  })
  it('returns false for invalid numbers', () => {
    expect(isValidIsraeliPhone('123')).toBe(false)
    expect(isValidIsraeliPhone('')).toBe(false)
  })
})

describe('toLocalIsraeliPhone', () => {
  it('converts E.164 to a local number with a trunk 0', () => {
    expect(toLocalIsraeliPhone('972504551558')).toBe('0504551558')
  })

  it('normalizes any accepted input to local form', () => {
    expect(toLocalIsraeliPhone('050-455-1558')).toBe('0504551558')
    expect(toLocalIsraeliPhone('+972504551558')).toBe('0504551558')
    expect(toLocalIsraeliPhone('504551558')).toBe('0504551558')
    expect(toLocalIsraeliPhone('0504551558')).toBe('0504551558')
  })

  it('keeps landlines local too', () => {
    expect(toLocalIsraeliPhone('97231234567')).toBe('031234567')
  })

  it('returns null for invalid input', () => {
    expect(toLocalIsraeliPhone('')).toBeNull()
    expect(toLocalIsraeliPhone('abc')).toBeNull()
    expect(toLocalIsraeliPhone('12345')).toBeNull()
  })
})

describe('formatIsraeliPhoneLocal', () => {
  it('formats a mobile number as prefix-3-4 with dashes', () => {
    expect(formatIsraeliPhoneLocal('972504551558')).toBe('050-455-1558')
    expect(formatIsraeliPhoneLocal('0504551558')).toBe('050-455-1558')
  })

  it('returns an empty string for empty/nullish input', () => {
    expect(formatIsraeliPhoneLocal('')).toBe('')
    expect(formatIsraeliPhoneLocal(null)).toBe('')
    expect(formatIsraeliPhoneLocal(undefined)).toBe('')
  })

  it('falls back to the raw string when it cannot be parsed', () => {
    expect(formatIsraeliPhoneLocal('not-a-phone')).toBe('not-a-phone')
  })
})

describe('splitLocalPhone', () => {
  it('splits a mobile number into a 3-digit prefix and the rest', () => {
    expect(splitLocalPhone('972504551558')).toEqual({ prefix: '050', rest: '4551558' })
    expect(splitLocalPhone('0504551558')).toEqual({ prefix: '050', rest: '4551558' })
  })

  it('returns empty parts for unparseable input', () => {
    expect(splitLocalPhone('')).toEqual({ prefix: '', rest: '' })
    expect(splitLocalPhone('abc')).toEqual({ prefix: '', rest: '' })
  })
})

describe('ISRAELI_MOBILE_PREFIXES', () => {
  it('contains the common mobile prefixes, each a 3-digit 05X string', () => {
    expect(ISRAELI_MOBILE_PREFIXES).toContain('050')
    expect(ISRAELI_MOBILE_PREFIXES).toContain('052')
    expect(ISRAELI_MOBILE_PREFIXES).toContain('054')
    for (const p of ISRAELI_MOBILE_PREFIXES) expect(p).toMatch(/^05\d$/)
  })
})
