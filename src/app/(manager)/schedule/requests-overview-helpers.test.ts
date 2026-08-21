import { describe, it, expect } from 'vitest'
import { buildWorkerVacationsByEmployee, isoForDayIndex, primaryWeekKind } from './requests-overview-helpers'
import type { WorkplaceVacation } from '@/lib/vacations/pending'
import type { ViewVacation } from '@/lib/schedule/view-data'

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

describe('primaryWeekKind', () => {
  // Displayed week: Sunday 2026-08-16 .. Saturday 2026-08-22
  const weekStart = '2026-08-16'
  const weekEnd = '2026-08-22'
  const vac = (dateFrom: string, dateTo: string, kind: ViewVacation['kind'] = 'vacation'): ViewVacation => ({
    employeeId: 'e1', dateFrom, dateTo, kind,
  })

  it('returns null when there are no absences', () => {
    expect(primaryWeekKind([], weekStart, weekEnd)).toBeNull()
  })

  it('ignores an absence that ended before the week', () => {
    expect(primaryWeekKind([vac('2026-08-01', '2026-08-10', 'miluim')], weekStart, weekEnd)).toBeNull()
  })

  it('ignores an absence that starts after the week', () => {
    expect(primaryWeekKind([vac('2026-08-25', '2026-08-30')], weekStart, weekEnd)).toBeNull()
  })

  it('returns the kind for a range fully inside the week', () => {
    expect(primaryWeekKind([vac('2026-08-18', '2026-08-19', 'miluim')], weekStart, weekEnd)).toBe('miluim')
  })

  it('returns the kind for a range straddling the week start', () => {
    expect(primaryWeekKind([vac('2026-08-10', '2026-08-16')], weekStart, weekEnd)).toBe('vacation')
  })

  it('returns the kind for a range straddling the week end', () => {
    expect(primaryWeekKind([vac('2026-08-22', '2026-09-01', 'sick')], weekStart, weekEnd)).toBe('sick')
  })

  it('skips a stale past absence and picks the one overlapping the week', () => {
    const vacs = [vac('2026-07-01', '2026-07-05'), vac('2026-08-20', '2026-08-21', 'miluim')]
    expect(primaryWeekKind(vacs, weekStart, weekEnd)).toBe('miluim')
  })

  it('prefers the earliest dateFrom when several ranges overlap the week', () => {
    const vacs = [vac('2026-08-19', '2026-08-20', 'sick'), vac('2026-08-17', '2026-08-18', 'miluim')]
    expect(primaryWeekKind(vacs, weekStart, weekEnd)).toBe('miluim')
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
