import { describe, it, expect } from 'vitest'
import { markedRequiredCount, occupiedSlotRefs } from './marked-slots'

const reqs = [
  { day_of_week: 0, shift_type_id: 'st1', role_id: 'r1', count: 2 },
  { day_of_week: 0, shift_type_id: 'st1', role_id: 'r2', count: 1 },
  { day_of_week: 1, shift_type_id: 'st2', role_id: 'r1', count: 3 },
]

describe('markedRequiredCount', () => {
  it('sums the headcount of every marked slot', () => {
    const marks = [
      { day_of_week: 0, shift_type_id: 'st1', role_id: 'r1' },
      { day_of_week: 1, shift_type_id: 'st2', role_id: 'r1' },
    ]
    expect(markedRequiredCount(reqs, marks)).toBe(5)
  })

  it('a mark on a slot with no requirement adds nothing', () => {
    expect(markedRequiredCount(reqs, [{ day_of_week: 6, shift_type_id: 'st3', role_id: 'r9' }])).toBe(0)
  })

  it('no marks → 0', () => {
    expect(markedRequiredCount(reqs, [])).toBe(0)
  })

  it('a marked slot that has an assignment is NOT waived', () => {
    const marks = [{ day_of_week: 0, shift_type_id: 'st1', role_id: 'r1' }]
    const assigns = [{ day_of_week: 0, shift_type_id: 'st1', role_id: 'r1' }]
    expect(markedRequiredCount(reqs, marks, assigns)).toBe(0)
  })

  it('assignments elsewhere do not block the waiver', () => {
    const marks = [{ day_of_week: 0, shift_type_id: 'st1', role_id: 'r1' }]
    const assigns = [{ day_of_week: 1, shift_type_id: 'st2', role_id: 'r1' }]
    expect(markedRequiredCount(reqs, marks, assigns)).toBe(2)
  })

  it('duplicate rows for one slot are summed once per requirement row', () => {
    const dupes = [...reqs, { day_of_week: 0, shift_type_id: 'st1', role_id: 'r1', count: 1 }]
    expect(markedRequiredCount(dupes, [{ day_of_week: 0, shift_type_id: 'st1', role_id: 'r1' }])).toBe(3)
  })
})

describe('occupiedSlotRefs', () => {
  // st1 = morning, st2 = noon, st12 = the 07–19 twelve-hour variant.
  const keyById = new Map([['st1', 'morning'], ['st2', 'noon'], ['st12', 'm12_day']])
  const idByKey = new Map([['morning', 'st1'], ['noon', 'st2'], ['m12_day', 'st12']])

  it('a base assignment occupies its own slot', () => {
    const refs = occupiedSlotRefs([{ day_of_week: 0, shift_type_id: 'st1', role_id: 'r1' }], keyById, idByKey)
    expect(refs).toEqual([{ day_of_week: 0, shift_type_id: 'st1', role_id: 'r1' }])
  })

  it('a 12h assignment occupies every base slot it covers', () => {
    const refs = occupiedSlotRefs([{ day_of_week: 3, shift_type_id: 'st12', role_id: 'r1' }], keyById, idByKey)
    expect(refs).toEqual([
      { day_of_week: 3, shift_type_id: 'st1', role_id: 'r1' },
      { day_of_week: 3, shift_type_id: 'st2', role_id: 'r1' },
    ])
  })

  it('a marked slot covered by a 12h shift is therefore NOT waived', () => {
    const reqs = [{ day_of_week: 3, shift_type_id: 'st2', role_id: 'r1', count: 2 }]
    const marks = [{ day_of_week: 3, shift_type_id: 'st2', role_id: 'r1' }]
    const occupied = occupiedSlotRefs([{ day_of_week: 3, shift_type_id: 'st12', role_id: 'r1' }], keyById, idByKey)
    expect(markedRequiredCount(reqs, marks, occupied)).toBe(0)
  })

  it('an unknown shift type contributes nothing', () => {
    expect(occupiedSlotRefs([{ day_of_week: 0, shift_type_id: 'gone', role_id: 'r1' }], keyById, idByKey)).toEqual([])
  })
})
