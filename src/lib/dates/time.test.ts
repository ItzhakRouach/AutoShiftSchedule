import { describe, it, expect } from 'vitest'
import { hhmm } from './time'

describe('hhmm', () => {
  it('strips seconds from a Postgres time value', () => {
    expect(hhmm('18:00:00')).toBe('18:00')
    expect(hhmm('07:30:00')).toBe('07:30')
  })

  it('leaves an HH:MM value unchanged', () => {
    expect(hhmm('18:00')).toBe('18:00')
  })

  it('returns empty string for null/undefined/empty', () => {
    expect(hhmm(null)).toBe('')
    expect(hhmm(undefined)).toBe('')
    expect(hhmm('')).toBe('')
  })
})
