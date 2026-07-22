import { describe, it, expect } from 'vitest'
import { buildImportKey, buildWeekShifts } from './build-week'

const TYPES = {
  morning: { id: 'morning', name: 'בוקר', start_hour: 7, hours: 8 },
  noon: { id: 'noon', name: 'צהריים', start_hour: 15, hours: 8 },
  night: { id: 'night', name: 'לילה', start_hour: 23, hours: 8 },
  m12night: { id: 'm12night', name: 'לילה 12ש׳', start_hour: 19, hours: 12 },
  m12day: { id: 'm12day', name: 'יום 12ש׳', start_hour: 7, hours: 12 },
}

function build(weekStart: string, assignments: { day_of_week: number; shift_type_id: string }[], holidays: string[] = []) {
  return buildWeekShifts({ weekStart, assignments, shiftTypesById: TYPES, holidaySet: new Set(holidays) })
}

describe('buildImportKey', () => {
  it('is stable per week', () => {
    expect(buildImportKey('2026-07-19')).toBe('mishmeret:2026-07-19')
  })
})

describe('buildWeekShifts — Israel timezone correctness', () => {
  it('summer (+03:00): Sunday morning 07:00 → 04:00Z', () => {
    const [s] = build('2026-07-19', [{ day_of_week: 0, shift_type_id: 'morning' }])
    expect(s.start).toBe('2026-07-19T04:00:00.000Z')
    expect(s.end).toBe('2026-07-19T12:00:00.000Z')
  })

  it('winter (+02:00): Sunday morning 07:00 → 05:00Z', () => {
    const [s] = build('2026-01-18', [{ day_of_week: 0, shift_type_id: 'morning' }])
    expect(s.start).toBe('2026-01-18T05:00:00.000Z')
    expect(s.end).toBe('2026-01-18T13:00:00.000Z')
  })

  it('DST spring-forward week (starts Fri 2026-03-27): Thu is +02, Fri is +03', () => {
    const shifts = build('2026-03-22', [
      { day_of_week: 4, shift_type_id: 'morning' }, // Thu 2026-03-26
      { day_of_week: 5, shift_type_id: 'morning' }, // Fri 2026-03-27 (DST began 02:00)
    ])
    expect(shifts[0].start).toBe('2026-03-26T05:00:00.000Z')
    expect(shifts[1].start).toBe('2026-03-27T04:00:00.000Z')
  })

  it('DST fall-back: Sun 2026-10-25 is already +02', () => {
    const [s] = build('2026-10-25', [{ day_of_week: 0, shift_type_id: 'morning' }])
    expect(s.start).toBe('2026-10-25T05:00:00.000Z')
  })

  it('night shift crosses midnight: end lands on the next civil day', () => {
    const [s] = build('2026-07-19', [{ day_of_week: 0, shift_type_id: 'night' }])
    expect(s.start).toBe('2026-07-19T20:00:00.000Z') // 23:00+03:00
    expect(s.end).toBe('2026-07-20T04:00:00.000Z') // 07:00 next day
  })

  it('12h night 19:00+12h → 07:00 next day', () => {
    const [s] = build('2026-07-19', [{ day_of_week: 2, shift_type_id: 'm12night' }])
    expect(s.start).toBe('2026-07-21T16:00:00.000Z')
    expect(s.end).toBe('2026-07-22T04:00:00.000Z')
  })

  it('12h day 07:00+12h — Friday instance spans into the Shabbat window (instants only)', () => {
    const [s] = build('2026-07-19', [{ day_of_week: 5, shift_type_id: 'm12day' }])
    expect(s.start).toBe('2026-07-24T04:00:00.000Z') // Fri 07:00+03:00
    expect(s.end).toBe('2026-07-24T16:00:00.000Z')   // Fri 19:00+03:00 — GuardPay prices the 16:00+ blocks as Shabbat
  })
})

describe('buildWeekShifts — holidays, comments, ordering', () => {
  it('holiday date flags the shift; ordinary date does not', () => {
    const shifts = build(
      '2026-07-19',
      [
        { day_of_week: 1, shift_type_id: 'morning' }, // 2026-07-20 (holiday below)
        { day_of_week: 2, shift_type_id: 'morning' },
      ],
      ['2026-07-20'],
    )
    expect(shifts[0].isHoliday).toBe(true)
    expect(shifts[1].isHoliday).toBe(false)
  })

  it('erev-chag: a shift starting ≥16:00 the day BEFORE a holiday is flagged', () => {
    const shifts = build(
      '2026-07-19',
      [
        { day_of_week: 1, shift_type_id: 'noon' }, // starts 15:00 on erev chag → NOT flagged
        { day_of_week: 1, shift_type_id: 'night' }, // starts 23:00 on erev chag → flagged
      ],
      ['2026-07-21'],
    )
    expect(shifts.find((s) => s.comment.includes('צהריים'))!.isHoliday).toBe(false)
    expect(shifts.find((s) => s.comment.includes('לילה'))!.isHoliday).toBe(true)
  })

  it('comment carries the shift-type name; unknown shift types are skipped; output sorted by start', () => {
    const shifts = build('2026-07-19', [
      { day_of_week: 3, shift_type_id: 'noon' },
      { day_of_week: 0, shift_type_id: 'morning' },
      { day_of_week: 1, shift_type_id: 'ghost-type' },
    ])
    expect(shifts).toHaveLength(2)
    expect(shifts[0].comment).toBe('יובא ממשמרת · בוקר')
    expect(shifts[0].start < shifts[1].start).toBe(true)
  })
})
