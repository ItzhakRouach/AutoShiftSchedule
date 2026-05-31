import { describe, it, expect } from 'vitest'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes)
    .map((b) => CODE_CHARS[b % CODE_CHARS.length])
    .join('')
}

describe('invite code generator', () => {
  it('generates codes of the correct length', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCode()).toHaveLength(CODE_LENGTH)
    }
  })

  it('generates codes using only allowed characters', () => {
    const allowed = new Set(CODE_CHARS.split(''))
    for (let i = 0; i < 50; i++) {
      const code = generateCode()
      for (const char of code) {
        expect(allowed.has(char), `Unexpected char: ${char}`).toBe(true)
      }
    }
  })

  it('generates unique codes (extremely unlikely to collide over 1000 runs)', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      codes.add(generateCode())
    }
    // Allow at most 1 collision over 1000 codes
    expect(codes.size).toBeGreaterThan(998)
  })

  it('never contains ambiguous chars (0, O, I, 1)', () => {
    const ambiguous = new Set(['0', 'O', 'I', '1'])
    for (let i = 0; i < 100; i++) {
      const code = generateCode()
      for (const char of code) {
        expect(ambiguous.has(char)).toBe(false)
      }
    }
  })
})
