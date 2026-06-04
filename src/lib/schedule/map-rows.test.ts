import { describe, it, expect } from 'vitest'
import { mapToEngineInput, seedFromUuid, weekDatesFrom, type MapInput } from './map-rows'

const SHIFT_TYPES = [
  { id: 'st-morning', key: 'morning' },
  { id: 'st-noon', key: 'noon' },
  { id: 'st-night', key: 'night' },
  { id: 'st-12', key: 'm12_day' }, // fallback should be excluded by caller; not in base map
]

function baseRows(over: Partial<MapInput> = {}): MapInput {
  return {
    weekDates: weekDatesFrom('2026-06-07'), // a Sunday
    shiftTypes: SHIFT_TYPES,
    roles: [{ id: 'r1', name: 'מאבטח' }],
    employees: [
      {
        id: 'e1',
        employment_type: 'full',
        min_shifts_per_week: 2,
        max_shifts_per_week: 5,
        observes_shabbat: true,
        observes_holidays: false,
        must_accept: false,
      },
    ],
    employeeRoles: [{ employee_id: 'e1', role_id: 'r1' }],
    availability: [],
    requests: [],
    vacations: [],
    requirements: [],
    settings: null,
    seed: 1,
    ...over,
  }
}

describe('mapToEngineInput', () => {
  it('builds shiftTypeId→key map (base shifts only) and keyToShiftTypeId', () => {
    const { keyToShiftTypeId } = mapToEngineInput(baseRows())
    expect(keyToShiftTypeId).toEqual({
      morning: 'st-morning',
      noon: 'st-noon',
      night: 'st-night',
    })
  })

  it('maps role UUIDs to role names (engine keys roles by name) + nameToRoleId', () => {
    const { input, nameToRoleId } = mapToEngineInput(baseRows())
    expect(input.employees[0].roleIds).toEqual(['מאבטח'])
    expect(nameToRoleId).toEqual({ מאבטח: 'r1' })
  })

  it('maps employee fields (shabbat observer gets observesHolidays=true via safety-net derive)', () => {
    const { input } = mapToEngineInput(baseRows())
    const e = input.employees[0]
    expect(e).toMatchObject({
      id: 'e1',
      employmentType: 'full',
      minShifts: 2,
      maxShifts: 5,
      observesShabbat: true,
      // shabbat implies holidays — adapter derives this even if DB column is false
      observesHolidays: true,
      mustAccept: false,
    })
  })

  it('adapter derive: shabbat=false, holidays=false → observesHolidays=false', () => {
    const { input } = mapToEngineInput(
      baseRows({
        employees: [{
          id: 'e1', employment_type: 'full', min_shifts_per_week: 2,
          max_shifts_per_week: 5, observes_shabbat: false, observes_holidays: false, must_accept: false,
        }],
      }),
    )
    expect(input.employees[0].observesHolidays).toBe(false)
  })

  it('groups availability by day → shift keys; no rows = null (unrestricted)', () => {
    const noAvail = mapToEngineInput(baseRows())
    expect(noAvail.input.employees[0].availability).toBeNull()

    const withAvail = mapToEngineInput(
      baseRows({
        availability: [
          { employee_id: 'e1', day_of_week: 0, shift_type_id: 'st-morning' },
          { employee_id: 'e1', day_of_week: 0, shift_type_id: 'st-night' },
          { employee_id: 'e1', day_of_week: 2, shift_type_id: 'st-noon' },
        ],
      }),
    )
    expect(withAvail.input.employees[0].availability).toEqual({
      0: ['morning', 'night'],
      2: ['noon'],
    })
  })

  it('merges vacation date ranges into off=true', () => {
    // weekDates start 2026-06-07 (Sun). Day index 1 = 2026-06-08.
    const { input } = mapToEngineInput(
      baseRows({
        vacations: [{ employee_id: 'e1', date_from: '2026-06-08', date_to: '2026-06-09' }],
      }),
    )
    expect(input.requests['e1'][0].off).toBe(false)
    expect(input.requests['e1'][1].off).toBe(true) // 06-08
    expect(input.requests['e1'][2].off).toBe(true) // 06-09
    expect(input.requests['e1'][3].off).toBe(false)
  })

  it('maps request off + preferred_shift_ids→keys, defaults missing days', () => {
    const { input } = mapToEngineInput(
      baseRows({
        requests: [
          { employee_id: 'e1', day_of_week: 0, is_off: true, preferred_shift_ids: [] },
          { employee_id: 'e1', day_of_week: 1, is_off: false, preferred_shift_ids: ['st-morning', 'st-night'] },
        ],
      }),
    )
    expect(input.requests['e1'][0]).toEqual({ off: true, preferred: [] })
    expect(input.requests['e1'][1]).toEqual({ off: false, preferred: ['morning', 'night'] })
    expect(input.requests['e1'][5]).toEqual({ off: false, preferred: [] })
  })

  it('builds requirements[day][key][roleId]=count and ignores unknown shift types', () => {
    const { input } = mapToEngineInput(
      baseRows({
        requirements: [
          { day_of_week: 0, shift_type_id: 'st-morning', role_id: 'r1', count: 2 },
          { day_of_week: 0, shift_type_id: 'st-12', role_id: 'r1', count: 9 }, // fallback ignored
        ],
      }),
    )
    expect(input.requirements[0].morning).toEqual({ מאבטח: 2 })
    expect(input.requirements[0]['m12_day' as 'morning']).toBeUndefined()
  })

  it('applies settings defaults when no row', () => {
    const { input } = mapToEngineInput(baseRows())
    expect(input.settings).toEqual({ minRestHours: 8, idealRestHours: 16, allow12hFallback: true })
  })

  it('uses provided settings row', () => {
    const { input } = mapToEngineInput(
      baseRows({ settings: { min_rest_hours: 10, ideal_rest_hours: 20, allow_12h_fallback: false } }),
    )
    expect(input.settings).toEqual({ minRestHours: 10, idealRestHours: 20, allow12hFallback: false })
  })

  it('produces 7 plain days with no holidays', () => {
    const { input } = mapToEngineInput(baseRows())
    expect(input.days).toHaveLength(7)
    expect(input.days.every((d) => !d.isHoliday && !d.isHolidayEve)).toBe(true)
  })

  it('sets isHoliday and isHolidayEve from holidayDates; holiday-observer gets correct meta', () => {
    // Week: 2026-06-07..13. d2=2026-06-09=holiday, d1=eve.
    const { input } = mapToEngineInput(
      baseRows({
        holidayDates: new Set(['2026-06-09']),
        employees: [{
          id: 'e1', employment_type: 'full', min_shifts_per_week: 2,
          max_shifts_per_week: 5, observes_shabbat: false, observes_holidays: true, must_accept: false,
        }],
      }),
    )
    expect(input.days[2].isHoliday).toBe(true)
    expect(input.days[1].isHolidayEve).toBe(true)
    expect(input.days[0].isHoliday).toBe(false)
    expect(input.days[0].isHolidayEve).toBe(false)
    expect(input.employees[0].observesHolidays).toBe(true)
  })

  it('maps priorExtras per employee from rows.priorExtras; defaults to 0', () => {
    const { input } = mapToEngineInput(
      baseRows({
        employees: [
          { id: 'a', employment_type: 'full', min_shifts_per_week: 2, max_shifts_per_week: 5, observes_shabbat: false, observes_holidays: false, must_accept: false },
          { id: 'b', employment_type: 'full', min_shifts_per_week: 2, max_shifts_per_week: 5, observes_shabbat: false, observes_holidays: false, must_accept: false },
        ],
        employeeRoles: [
          { employee_id: 'a', role_id: 'r1' },
          { employee_id: 'b', role_id: 'r1' },
        ],
        priorExtras: { a: 2 },
      }),
    )
    const empA = input.employees.find((e) => e.id === 'a')
    const empB = input.employees.find((e) => e.id === 'b')
    expect(empA?.priorExtras).toBe(2)
    expect(empB?.priorExtras).toBe(0)
  })
})

describe('seedFromUuid', () => {
  it('is deterministic for the same uuid', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(seedFromUuid(id)).toBe(seedFromUuid(id))
  })
  it('differs for different uuids and returns a uint32', () => {
    const a = seedFromUuid('aaaa')
    const b = seedFromUuid('bbbb')
    expect(a).not.toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThanOrEqual(0xffffffff)
  })
})

describe('weekDatesFrom', () => {
  it('returns 7 consecutive ISO dates', () => {
    expect(weekDatesFrom('2026-06-07')).toEqual([
      '2026-06-07', '2026-06-08', '2026-06-09', '2026-06-10',
      '2026-06-11', '2026-06-12', '2026-06-13',
    ])
  })
})
