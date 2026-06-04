// Adapter unit: computePriorExtras reads assignments for a pre-resolved prior
// published period and returns max(0, shiftsThen − minShifts) per employee.
import { describe, it, expect } from 'vitest'
import { computePriorExtras } from './build-input'

const PRIOR = { id: 'prior-1', week_start_date: '2026-05-25' }
const EMPS = [
  { id: 'a', min_shifts_per_week: 5 },
  { id: 'b', min_shifts_per_week: 2 },
  { id: 'c', min_shifts_per_week: null },
]

// Mirror the fakeDb shape used in prior-deficit.test.ts.
function fakeDb(rows: { employee_id: string; day_of_week: number }[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: rows }),
      }),
    }),
  } as unknown as Parameters<typeof computePriorExtras>[0]
}

describe('computePriorExtras', () => {
  it('returns max(0, shiftsThen − minShifts) per employee', async () => {
    const asg = [
      { employee_id: 'a', day_of_week: 0 },
      { employee_id: 'a', day_of_week: 1 },
      { employee_id: 'a', day_of_week: 2 },
      { employee_id: 'a', day_of_week: 3 },
      { employee_id: 'a', day_of_week: 4 },
      { employee_id: 'a', day_of_week: 5 }, // a worked 6 with min 5 → extras = 1
      { employee_id: 'b', day_of_week: 0 }, // b worked 1 with min 2 → extras = 0 (deficit, not extras)
    ]
    const x = await computePriorExtras(fakeDb(asg), PRIOR, EMPS)
    expect(x).toEqual({ a: 1, b: 0, c: 0 })
  })

  it('deduplicates duplicate (employee, day) pairs (defensive)', async () => {
    const asg = [
      { employee_id: 'a', day_of_week: 0 },
      { employee_id: 'a', day_of_week: 0 }, // duplicate — counts once
      { employee_id: 'a', day_of_week: 1 },
      { employee_id: 'a', day_of_week: 2 },
      { employee_id: 'a', day_of_week: 3 },
      { employee_id: 'a', day_of_week: 4 },
      { employee_id: 'a', day_of_week: 5 },
      { employee_id: 'a', day_of_week: 6 }, // a worked 7 with min 5 → extras = 2
    ]
    const x = await computePriorExtras(fakeDb(asg), PRIOR, [{ id: 'a', min_shifts_per_week: 5 }])
    expect(x.a).toBe(2)
  })

  it('returns empty object when there is no prior period', async () => {
    const x = await computePriorExtras(fakeDb([]), null, EMPS)
    expect(x).toEqual({})
  })
})
