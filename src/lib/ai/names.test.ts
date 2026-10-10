// The model answers using short keys; the app puts real names back. The obvious
// bug here is prefix collision (e1 inside e10), so that is what this pins down.
import { describe, it, expect } from 'vitest'
import { substituteNames } from './names'

const names = { u0: 'דני', u1: 'אורית', u10: 'שלו', u2: 'צחי' }
const maps = { empId: (k: string) => ({ e0: 'u0', e1: 'u1', e10: 'u10', e2: 'u2' })[k] }

describe('substituteNames', () => {
  it('replaces short keys with names', () => {
    expect(substituteNames('e0 עובד בבוקר', maps, names)).toBe('דני עובד בבוקר')
  })

  it('does not let e1 match inside e10', () => {
    expect(substituteNames('e10 ו-e1 מתחלפים', maps, names)).toBe('שלו ו-אורית מתחלפים')
  })

  it('handles keys adjacent to Hebrew punctuation and parentheses', () => {
    expect(substituteNames('(e2), e0: שלושה', maps, names)).toBe('(צחי), דני: שלושה')
  })

  it('leaves an unknown key untouched rather than blanking it', () => {
    expect(substituteNames('e99 לא קיים', maps, names)).toBe('e99 לא קיים')
  })

  it('leaves role keys and ordinary words alone', () => {
    expect(substituteNames('R0 ו-e0 ב-12h', maps, names)).toBe('R0 ו-דני ב-12h')
    expect(substituteNames('level0 token', maps, names)).toBe('level0 token')
  })

  it('falls back to the employee id when no name is known', () => {
    expect(substituteNames('e2 חסר שם', maps, {})).toBe('u2 חסר שם')
  })

  it('replaces every occurrence', () => {
    expect(substituteNames('e0, e0 ו-e0', maps, names)).toBe('דני, דני ו-דני')
  })
})
