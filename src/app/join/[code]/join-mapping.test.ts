import { describe, it, expect } from 'vitest'

type EmploymentType = 'full' | 'part' | 'student'

interface EmploymentDefaults {
  employment_type: EmploymentType
  min_shifts_per_week: number
  max_shifts_per_week: number | null
}

function getEmploymentDefaults(type: EmploymentType): EmploymentDefaults {
  if (type === 'full') {
    return { employment_type: 'full', min_shifts_per_week: 5, max_shifts_per_week: null }
  }
  if (type === 'part') {
    return { employment_type: 'part', min_shifts_per_week: 0, max_shifts_per_week: 4 }
  }
  return { employment_type: 'student', min_shifts_per_week: 0, max_shifts_per_week: 3 }
}

function getShabbatFlags(observes: boolean): { observes_shabbat: boolean; observes_holidays: boolean } {
  return { observes_shabbat: observes, observes_holidays: observes }
}

describe('join employment-type → min/max mapping', () => {
  it('full → min=5, max=null', () => {
    const result = getEmploymentDefaults('full')
    expect(result.employment_type).toBe('full')
    expect(result.min_shifts_per_week).toBe(5)
    expect(result.max_shifts_per_week).toBeNull()
  })

  it('part → min=0, max=4', () => {
    const result = getEmploymentDefaults('part')
    expect(result.employment_type).toBe('part')
    expect(result.min_shifts_per_week).toBe(0)
    expect(result.max_shifts_per_week).toBe(4)
  })

  it('student → min=0, max=3', () => {
    const result = getEmploymentDefaults('student')
    expect(result.employment_type).toBe('student')
    expect(result.min_shifts_per_week).toBe(0)
    expect(result.max_shifts_per_week).toBe(3)
  })
})

describe('join Shabbat observance → both flags', () => {
  it('observer=true → observes_shabbat=true, observes_holidays=true', () => {
    const result = getShabbatFlags(true)
    expect(result.observes_shabbat).toBe(true)
    expect(result.observes_holidays).toBe(true)
  })

  it('observer=false → observes_shabbat=false, observes_holidays=false', () => {
    const result = getShabbatFlags(false)
    expect(result.observes_shabbat).toBe(false)
    expect(result.observes_holidays).toBe(false)
  })
})
