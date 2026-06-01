import { describe, it, expect } from 'vitest'
import { parseFormData } from './form'

const validUUID = '550e8400-e29b-41d4-a716-446655440000'

/** Build a minimal FormData with the required fields + any overrides. */
function makeForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('name', 'ישראל ישראלי')
  fd.set('phone', '')
  fd.set('minShifts', '3')
  fd.set('maxShifts', '')
  fd.set('employmentType', 'full')
  fd.set('mustAccept', 'false')
  fd.set('customAvailability', 'false')
  fd.set('availability', '[]')
  fd.append('roleIds', validUUID)
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v)
  return fd
}

describe('parseFormData — combined שומר שבת וחג toggle', () => {
  it('toggle ON → both observesShabbat and observesHolidays are true', () => {
    const fd = makeForm({ observesShabbat: 'true', observesHolidays: 'true' })
    const result = parseFormData(fd)
    expect(result.observesShabbat).toBe(true)
    expect(result.observesHolidays).toBe(true)
  })

  it('toggle OFF → both observesShabbat and observesHolidays are false', () => {
    const fd = makeForm({ observesShabbat: 'false', observesHolidays: 'false' })
    const result = parseFormData(fd)
    expect(result.observesShabbat).toBe(false)
    expect(result.observesHolidays).toBe(false)
  })

  it('legacy: only observesShabbat=true sent → both become true (OR derive)', () => {
    const fd = makeForm({ observesShabbat: 'true', observesHolidays: 'false' })
    const result = parseFormData(fd)
    expect(result.observesShabbat).toBe(true)
    expect(result.observesHolidays).toBe(true)
  })

  it('legacy: only observesHolidays=true sent → both become true (OR derive)', () => {
    const fd = makeForm({ observesShabbat: 'false', observesHolidays: 'true' })
    const result = parseFormData(fd)
    expect(result.observesShabbat).toBe(true)
    expect(result.observesHolidays).toBe(true)
  })

  it('mustAccept is parsed independently', () => {
    const fd = makeForm({ observesShabbat: 'false', observesHolidays: 'false', mustAccept: 'true' })
    const result = parseFormData(fd)
    expect(result.mustAccept).toBe(true)
    expect(result.observesShabbat).toBe(false)
  })
})
