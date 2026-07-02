import { describe, it, expect } from 'vitest'
import { planTwelvePair, pairTwelveFills, type DayRoleSlot } from './twelve-pair-core'

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

describe('pairTwelveFills', () => {
  it('morning row fills morning under the morning role + noon under the pair role', () => {
    const fills = pairTwelveFills('role-morning', 'role-night', 'role-pair')
    expect(fills.morning).toEqual([
      { shift: 'morning', role_id: 'role-morning' },
      { shift: 'noon', role_id: 'role-pair' },
    ])
  })

  it('night row fills night under the (preserved) night role', () => {
    const fills = pairTwelveFills('role-morning', 'role-night', 'role-pair')
    expect(fills.night).toEqual([{ shift: 'night', role_id: 'role-night' }])
  })

  it('when the night role equals the pair role, night fill still uses the night role', () => {
    const fills = pairTwelveFills('role-morning', 'role-pair', 'role-pair')
    expect(fills.night).toEqual([{ shift: 'night', role_id: 'role-pair' }])
  })
})
