import { describe, it, expect } from 'vitest'
import { mapSlotMarks } from './view-data-grid'

const idToKey = { st1: 'morning', st3: 'night' }

describe('mapSlotMarks', () => {
  it('re-keys rows from shift_type_id to the shift key', () => {
    const marks = mapSlotMarks(
      [{ day_of_week: 2, shift_type_id: 'st3', role_id: 'r1', label: 'יום כיפור' }],
      idToKey,
    )
    expect(marks).toEqual([{ day: 2, shiftKey: 'night', roleId: 'r1', label: 'יום כיפור' }])
  })

  it('a null label becomes an empty caption', () => {
    const marks = mapSlotMarks([{ day_of_week: 0, shift_type_id: 'st1', role_id: 'r1', label: null }], idToKey)
    expect(marks[0].label).toBe('')
  })

  it('drops rows whose shift type is unknown', () => {
    expect(mapSlotMarks([{ day_of_week: 0, shift_type_id: 'gone', role_id: 'r1', label: 'x' }], idToKey)).toEqual([])
  })
})
