import { describe, it, expect } from 'vitest'
import { normalizeIsraeliPhone, isValidIsraeliPhone } from './phone'

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
