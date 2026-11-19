import { describe, it, expect } from 'vitest'
import { swapRpcArgs, invertSwap, heldCells, planRevert, type DbSwap } from './swap-rows'

const side = (employeeId: string, day: number, shiftTypeId: string, source: 'auto' | 'manual' = 'auto') =>
  ({ employeeId, day, shiftTypeId, roleId: 'R', source })

// Dana: Sun morning; Avi: Mon night.
const sw: DbSwap = { a: side('dana', 0, 'MORN'), b: side('avi', 1, 'NIGHT', 'manual') }

const row = (employee_id: string, day_of_week: number, shift_type_id: string) =>
  ({ employee_id, day_of_week, shift_type_id, role_id: 'R' })

describe('swapRpcArgs', () => {
  it('moves each worker into the other cell, written as manual', () => {
    expect(swapRpcArgs('P', sw, 'manual')).toMatchObject({
      a_employee: 'dana', a_from_day: 0, a_to_day: 1, a_to_shift: 'NIGHT', a_source: 'manual',
      b_employee: 'avi', b_from_day: 1, b_to_day: 0, b_to_shift: 'MORN', b_source: 'manual',
    })
  })

  it('restores each cell’s original source on revert', () => {
    expect(swapRpcArgs('P', invertSwap(sw), 'restore')).toMatchObject({ a_source: 'manual', b_source: 'auto' })
  })
})

describe('planRevert', () => {
  it('inverts a swap the week still shows', () => {
    const after = heldCells([row('avi', 0, 'MORN'), row('dana', 1, 'NIGHT')])
    expect(planRevert(after, [sw])).toEqual([invertSwap(sw)])
    expect(swapRpcArgs('P', invertSwap(sw), 'restore')).toMatchObject({
      a_employee: 'avi', a_from_day: 0, a_to_day: 1, a_to_shift: 'NIGHT',
      b_employee: 'dana', b_from_day: 1, b_to_day: 0, b_to_shift: 'MORN',
    })
  })

  it('refuses when the week was edited since', () => {
    const edited = heldCells([row('avi', 0, 'NOON'), row('dana', 1, 'NIGHT')])
    expect(planRevert(edited, [sw])).toBeNull()
  })

  it('refuses when a worker was given another shift on the day they return to', () => {
    // Since the AI, Avi was also put on Monday noon — he cannot go back to Mon night.
    const after = heldCells([row('avi', 0, 'MORN'), row('dana', 1, 'NIGHT'), row('avi', 1, 'NOON')])
    expect(planRevert(after, [sw])).toBeNull()
  })

  it('undoes chained swaps last-first', () => {
    // Swap 2 moves Dana (now on Mon night) with Yoni (Tue morning).
    const sw2: DbSwap = { a: side('dana', 1, 'NIGHT', 'manual'), b: side('yoni', 2, 'MORN') }
    const after = heldCells([row('avi', 0, 'MORN'), row('yoni', 1, 'NIGHT'), row('dana', 2, 'MORN')])
    const plan = planRevert(after, [sw, sw2])
    expect(plan).toEqual([invertSwap(sw2), invertSwap(sw)])
  })

  it('ignores temp rows', () => {
    const cells = heldCells([{ employee_id: null, day_of_week: 0, shift_type_id: 'X', role_id: 'R' }])
    expect(cells.size).toBe(0)
  })
})
