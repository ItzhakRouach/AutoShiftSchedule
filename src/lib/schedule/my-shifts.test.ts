import { describe, it, expect } from 'vitest'
import { buildMyWeek, fromCurrentWeek, pickNextShift, whenLabel, type ShiftTypeLike } from './my-shifts'

const TZ = 'Asia/Jerusalem'
const shiftTypes: ShiftTypeLike[] = [
  { id: 'st-m', key: 'morning', name: 'בוקר', color: '#F2A93B', start_hour: 7, hours: 8 },
  { id: 'st-n', key: 'night', name: 'לילה', color: '#5B61D6', start_hour: 23, hours: 8 },
  { id: 'st-12', key: 'm12_day', name: '12ש׳ יום', color: '#888888', start_hour: 7, hours: 12 },
]
const roles = new Map([['r1', 'מאבטח']])
// Israel is UTC+2 in November (no DST), so 07:00 local = 05:00Z.
const at = (iso: string) => Date.parse(iso)

describe('buildMyWeek', () => {
  const week = buildMyWeek('2026-11-15', [
    { day_of_week: 0, shift_type_id: 'st-m', role_id: 'r1' },
    { day_of_week: 6, shift_type_id: 'st-n', role_id: 'r1' },
    { day_of_week: 2, shift_type_id: 'st-12', role_id: 'r1' },
    { day_of_week: 3, shift_type_id: 'gone', role_id: 'r1' }, // unknown shift type → skipped
  ], shiftTypes, roles, TZ)

  it('returns all seven days with their dates, empty days included', () => {
    expect(week.days.map((d) => d.dateISO)).toEqual([
      '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21',
    ])
    expect(week.days[1].shift).toBeNull()
    expect(week.days[3].shift).toBeNull()
  })

  it('resolves name, hours text, role and wall-clock start/end in the workplace timezone', () => {
    const s = week.days[0].shift!
    expect(s.name).toBe('בוקר')
    expect(s.time).toBe('07:00–15:00')
    expect(s.roleName).toBe('מאבטח')
    expect(s.startMs).toBe(at('2026-11-15T05:00:00Z'))
    expect(s.endMs).toBe(at('2026-11-15T13:00:00Z'))
  })

  it('a night shift ends on the following morning', () => {
    const s = week.days[6].shift!
    expect(s.startMs).toBe(at('2026-11-21T21:00:00Z'))
    expect(s.endMs).toBe(at('2026-11-22T05:00:00Z'))
  })

  it('totals count shifts and real hours (12h aware)', () => {
    expect(week.shiftCount).toBe(3)
    expect(week.hours).toBe(8 + 8 + 12)
  })
})

describe('pickNextShift', () => {
  const w1 = buildMyWeek('2026-11-15', [{ day_of_week: 0, shift_type_id: 'st-m', role_id: 'r1' }], shiftTypes, roles, TZ)
  const w2 = buildMyWeek('2026-11-22', [{ day_of_week: 1, shift_type_id: 'st-n', role_id: 'r1' }], shiftTypes, roles, TZ)

  it('picks the earliest shift that has not ended yet, across weeks', () => {
    expect(pickNextShift([w2, w1], at('2026-11-13T10:00:00Z'))?.dateISO).toBe('2026-11-15')
    expect(pickNextShift([w1, w2], at('2026-11-15T14:00:00Z'))?.dateISO).toBe('2026-11-23')
  })

  it('keeps a shift that is in progress', () => {
    expect(pickNextShift([w1, w2], at('2026-11-15T09:00:00Z'))?.dateISO).toBe('2026-11-15')
  })

  it('returns null when nothing is left', () => {
    expect(pickNextShift([w1], at('2026-11-16T00:00:00Z'))).toBeNull()
  })
})

describe('whenLabel', () => {
  const s = buildMyWeek('2026-11-15', [{ day_of_week: 0, shift_type_id: 'st-m', role_id: 'r1' }], shiftTypes, roles, TZ).days[0].shift!

  it('names the distance in calendar days, in the workplace timezone', () => {
    expect(whenLabel(s, at('2026-11-15T06:00:00Z'), TZ)).toBe('עכשיו במשמרת')
    expect(whenLabel(s, at('2026-11-15T03:00:00Z'), TZ)).toBe('היום')
    expect(whenLabel(s, at('2026-11-14T20:00:00Z'), TZ)).toBe('מחר')
    expect(whenLabel(s, at('2026-11-13T10:00:00Z'), TZ)).toBe('בעוד יומיים')
    expect(whenLabel(s, at('2026-11-10T10:00:00Z'), TZ)).toBe('בעוד 5 ימים')
  })

  it('late evening local time still counts as the same calendar day', () => {
    // 2026-11-14 23:30 in Israel is 21:30Z — the shift is tomorrow, not today.
    expect(whenLabel(s, at('2026-11-14T21:30:00Z'), TZ)).toBe('מחר')
  })
})

describe('fromCurrentWeek', () => {
  const mk = (ws: string) => buildMyWeek(ws, [], shiftTypes, roles, TZ)
  it('keeps the week in progress and later weeks, oldest first', () => {
    const weeks = [mk('2026-11-22'), mk('2026-11-08'), mk('2026-11-15')]
    // Saturday 2026-11-21 23:00 local — still inside the 15–21 week.
    expect(fromCurrentWeek(weeks, at('2026-11-21T21:00:00Z'), TZ).map((w) => w.weekStart)).toEqual(['2026-11-15', '2026-11-22'])
    // One hour later it is Sunday the 22nd local.
    expect(fromCurrentWeek(weeks, at('2026-11-21T22:00:00Z'), TZ).map((w) => w.weekStart)).toEqual(['2026-11-22'])
  })
})
