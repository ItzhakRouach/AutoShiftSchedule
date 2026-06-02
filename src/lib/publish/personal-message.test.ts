import { describe, it, expect } from 'vitest'
import { buildPersonalMessage, type PersonalShift } from './personal-message'

describe('buildPersonalMessage', () => {
  it('lists shifts sorted by day then time of day', () => {
    const shifts: PersonalShift[] = [
      { day: 2, shiftKey: 'night', shiftLabel: 'לילה', roleName: 'מאבטח' },
      { day: 0, shiftKey: 'morning', shiftLabel: 'בוקר', roleName: 'מוקדן' },
      { day: 0, shiftKey: 'noon', shiftLabel: 'צהריים', roleName: 'מאבטח' },
    ]
    const msg = buildPersonalMessage('דנה', '01.06', shifts)
    expect(msg).toContain('שלום דנה')
    expect(msg).toContain('המשמרות שלך לשבוע 01.06')
    // Day 0 morning must come before day 0 noon, which comes before day 2 night.
    const iMorning = msg.indexOf('יום ראשון – בוקר (מוקדן)')
    const iNoon = msg.indexOf('יום ראשון – צהריים (מאבטח)')
    const iNight = msg.indexOf('יום שלישי – לילה (מאבטח)')
    expect(iMorning).toBeGreaterThan(-1)
    expect(iNoon).toBeGreaterThan(iMorning)
    expect(iNight).toBeGreaterThan(iNoon)
  })

  it('renders a no-shifts message when the employee has none', () => {
    const msg = buildPersonalMessage('יוסי', '01.06', [])
    expect(msg).toContain('שלום יוסי')
    expect(msg).toContain('לא שובצת למשמרות בשבוע 01.06')
  })

  it('uses the provided shiftLabel verbatim (e.g. 12h variants)', () => {
    const shifts: PersonalShift[] = [
      { day: 3, shiftKey: 'm12_day', shiftLabel: 'יום 12ש׳', roleName: 'אחמ״ש' },
    ]
    const msg = buildPersonalMessage('טל', '01.06', shifts)
    expect(msg).toContain('יום רביעי – יום 12ש׳ (אחמ״ש)')
  })
})
