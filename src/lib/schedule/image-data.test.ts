import { describe, it, expect } from 'vitest'
import { buildImageGrid, BASE_SHIFTS } from './image-data'

describe('buildImageGrid', () => {
  it('initialises an empty 7×3 grid with no assignments', () => {
    const grid = buildImageGrid([])
    for (let d = 0; d < 7; d++) {
      for (const sk of BASE_SHIFTS) {
        expect(grid[d][sk].employeeNames).toEqual([])
        expect(grid[d][sk].unfilled).toBe(false)
      }
    }
  })

  it('places employees in the correct cell', () => {
    const grid = buildImageGrid([
      { day_of_week: 0, shift_type_key: 'morning', employee_name: 'דנה' },
      { day_of_week: 0, shift_type_key: 'morning', employee_name: 'יוסי' },
      { day_of_week: 3, shift_type_key: 'night', employee_name: 'מאיה' },
    ])
    expect(grid[0]['morning'].employeeNames).toEqual(['דנה', 'יוסי'])
    expect(grid[3]['night'].employeeNames).toEqual(['מאיה'])
    expect(grid[0]['noon'].employeeNames).toEqual([])
  })

  it('ignores non-base shift keys (12h variants)', () => {
    const grid = buildImageGrid([
      { day_of_week: 1, shift_type_key: 'm12_day', employee_name: 'רן' },
    ])
    for (const sk of BASE_SHIFTS) {
      expect(grid[1][sk].employeeNames).toEqual([])
    }
  })

  it('ignores out-of-range day values', () => {
    const grid = buildImageGrid([
      { day_of_week: 9, shift_type_key: 'morning', employee_name: 'רן' },
    ])
    // Should not throw; day 9 slot simply doesn't exist in 0-6 grid
    for (let d = 0; d < 7; d++) {
      expect(grid[d]['morning'].employeeNames).toEqual([])
    }
  })

  it('marks unfilled when required > assigned', () => {
    const grid = buildImageGrid(
      [{ day_of_week: 2, shift_type_key: 'noon', employee_name: 'עמית' }],
      { 2: { noon: 3 } },
    )
    expect(grid[2]['noon'].unfilled).toBe(true)
    expect(grid[2]['noon'].employeeNames).toEqual(['עמית'])
  })

  it('does not mark unfilled when assigned >= required', () => {
    const grid = buildImageGrid(
      [
        { day_of_week: 0, shift_type_key: 'morning', employee_name: 'א' },
        { day_of_week: 0, shift_type_key: 'morning', employee_name: 'ב' },
      ],
      { 0: { morning: 2 } },
    )
    expect(grid[0]['morning'].unfilled).toBe(false)
  })
})
