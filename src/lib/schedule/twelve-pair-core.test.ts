import { describe, it, expect } from 'vitest'
import { planTwelvePair, type DayRoleSlot } from './twelve-pair-core'

const slots = (...s: DayRoleSlot[]) => s

describe('planTwelvePair', () => {
  it('removes the single noon person of the role (noonRequired=1)', () => {
    const plan = planTwelvePair({
      roleSlots: slots(
        { employeeId: 'm', shiftKey: 'morning' },
        { employeeId: 'c', shiftKey: 'noon' },
        { employeeId: 'n', shiftKey: 'night' },
      ),
      morningEmployeeId: 'm',
      nightEmployeeId: 'n',
      noonRequired: 1,
    })
    expect(plan.noonToRemove).toEqual(['c'])
  })

  it('keeps coverage: removes at most one when noon needs 2 and has 2', () => {
    // covered(1) + remaining must stay >= 2 → may remove only when surplus exists.
    const plan = planTwelvePair({
      roleSlots: slots(
        { employeeId: 'c1', shiftKey: 'noon' },
        { employeeId: 'c2', shiftKey: 'noon' },
      ),
      morningEmployeeId: 'm',
      nightEmployeeId: 'n',
      noonRequired: 2,
    })
    // current 2 + covered 1 - required 2 = 1 removable.
    expect(plan.noonToRemove).toEqual(['c1'])
  })

  it('removes none when removing would under-cover noon', () => {
    const plan = planTwelvePair({
      roleSlots: slots({ employeeId: 'c1', shiftKey: 'noon' }),
      morningEmployeeId: 'm',
      nightEmployeeId: 'n',
      noonRequired: 2,
    })
    // current 1 + covered 1 - required 2 = 0 removable.
    expect(plan.noonToRemove).toEqual([])
  })

  it('never removes the morning or night employee even if they were on noon', () => {
    const plan = planTwelvePair({
      roleSlots: slots(
        { employeeId: 'm', shiftKey: 'noon' },
        { employeeId: 'real', shiftKey: 'noon' },
      ),
      morningEmployeeId: 'm',
      nightEmployeeId: 'n',
      noonRequired: 1,
    })
    expect(plan.noonToRemove).toEqual(['real'])
  })

  it('removes none when role has no noon assignment', () => {
    const plan = planTwelvePair({
      roleSlots: slots({ employeeId: 'm', shiftKey: 'morning' }),
      morningEmployeeId: 'm',
      nightEmployeeId: 'n',
      noonRequired: 1,
    })
    expect(plan.noonToRemove).toEqual([])
  })
})
