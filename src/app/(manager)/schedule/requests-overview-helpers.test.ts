import { describe, it, expect } from 'vitest'
import { buildWorkerVacationsByEmployee, isoForDayIndex } from './requests-overview-helpers'
import type { WorkplaceVacation } from '@/lib/vacations/pending'

function makeVac(overrides: Partial<WorkplaceVacation> = {}): WorkplaceVacation {
  return {
    id: 'v1',
    employeeId: 'e1',
    employeeName: 'עובד',
    dateFrom: '2026-07-01',
    dateTo: '2026-07-03',
    status: 'approved',
    kind: 'vacation',
    ...overrides,
  }
}

describe('buildWorkerVacationsByEmployee', () => {
  it('groups vacations by employeeId', () => {
    const vacs = [
      makeVac({ id: 'v1', employeeId: 'e1' }),
      makeVac({ id: 'v2', employeeId: 'e2' }),
      makeVac({ id: 'v3', employeeId: 'e1' }),
    ]
    const grouped = buildWorkerVacationsByEmployee(vacs)
    expect(grouped.get('e1')?.map((v) => v.id)).toEqual(['v1', 'v3'])
    expect(grouped.get('e2')?.map((v) => v.id)).toEqual(['v2'])
  })

  it('returns an empty map for no vacations', () => {
    expect(buildWorkerVacationsByEmployee([]).size).toBe(0)
  })

  it('keeps kind and status intact per entry', () => {
    const vacs = [makeVac({ kind: 'miluim', status: 'pending' })]
    const grouped = buildWorkerVacationsByEmployee(vacs)
    const entry = grouped.get('e1')?.[0]
    expect(entry?.kind).toBe('miluim')
    expect(entry?.status).toBe('pending')
  })
})

describe('isoForDayIndex', () => {
  it('returns the week start itself for index 0', () => {
    expect(isoForDayIndex('2026-07-05', 0)).toBe('2026-07-05')
  })

  it('adds dayIndex days to the week start', () => {
    expect(isoForDayIndex('2026-07-05', 3)).toBe('2026-07-08')
  })

  it('rolls over into the next month correctly', () => {
    expect(isoForDayIndex('2026-07-29', 6)).toBe('2026-08-04')
  })
})
