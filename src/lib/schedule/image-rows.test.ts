import { describe, expect, it } from 'vitest'
import type { ScheduleView } from './view-types'
import type { ShiftKey } from '@/lib/scheduling/types'
import {
  buildImageDoc,
  CELL_PAD_V,
  DAY_HEADER_H,
  ENTRY_GAP,
  FRAME_PAD,
  GROUP_DIVIDER,
  HEADER_H,
  LINE_H,
  ROW_MIN,
  TWELVE_META_H,
} from './image-rows'

/** Minimal-but-real ScheduleView fixture, mirroring published-view.ts output. */
function makeView(overrides: Partial<ScheduleView> = {}): ScheduleView {
  return {
    periodId: 'p1',
    status: 'published',
    weekStart: '2026-07-19',
    days: Array.from({ length: 7 }, (_, i) => ({
      index: i,
      short: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][i],
      date: `${19 + i}.7`,
    })),
    shiftKeys: ['morning', 'noon', 'night'] as ShiftKey[],
    roles: [
      { id: 'r-ahmash', name: 'אחמ״ש', color: '#E0902A', rank: 3 },
      { id: 'r-guard', name: 'מאבטח', color: '#13A98E', rank: 1 },
    ],
    employees: [
      { id: 'e1', name: 'דנה כהן', color: '#3D6BF5' },
      { id: 'e2', name: 'יוסי לוי', color: '#B05AB5' },
    ],
    requirements: {},
    grid: {},
    twelve: [],
    temps: [],
    shiftTypeIdByKey: { morning: 'st-m', noon: 'st-n', night: 'st-l' },
    hasAssignments: true,
    feasibility: null,
    requests: [],
    requestedSet: new Set(),
    ...overrides,
  }
}

describe('buildImageDoc', () => {
  it('renders all roles for every shift when no requirements exist, in view order', () => {
    const doc = buildImageDoc(makeView(), 'מוקד ראשי')
    expect(doc.groups).toHaveLength(3)
    for (const g of doc.groups) {
      expect(g.rows.map((r) => r.roleName)).toEqual(['אחמ״ש', 'מאבטח'])
    }
  })

  it('filters each shift to roles that have any requirement that week', () => {
    const view = makeView({
      requirements: {
        0: { morning: { 'r-guard': 1 } },
        3: { noon: { 'r-ahmash': 1, 'r-guard': 1 } },
      },
    })
    const doc = buildImageDoc(view, 'w')
    const morning = doc.groups.find((g) => g.key === 'morning')!
    const noon = doc.groups.find((g) => g.key === 'noon')!
    const night = doc.groups.find((g) => g.key === 'night')!
    expect(morning.rows.map((r) => r.roleName)).toEqual(['מאבטח'])
    expect(noon.rows.map((r) => r.roleName)).toEqual(['אחמ״ש', 'מאבטח'])
    // no requirements at all for night → fall back to all roles
    expect(night.rows.map((r) => r.roleName)).toEqual(['אחמ״ש', 'מאבטח'])
  })

  it('places base entries with the employee name and color', () => {
    const view = makeView({
      grid: { 0: { morning: { 'r-ahmash': ['e1'] } } },
    })
    const doc = buildImageDoc(view, 'w')
    const cell = doc.groups[0].rows[0].cells[0]
    expect(cell.entries).toEqual([
      { name: 'דנה כהן', color: '#3D6BF5', is12h: false },
    ])
  })

  it('renders temp workers by their free-text name with the default text color', () => {
    const view = makeView({
      temps: [{ day: 2, shiftKey: 'noon', roleId: 'r-guard', assignmentId: 'a9', name: 'עובד זמני' }],
    })
    const doc = buildImageDoc(view, 'w')
    const noon = doc.groups.find((g) => g.key === 'noon')!
    const guardRow = noon.rows.find((r) => r.roleName === 'מאבטח')!
    expect(guardRow.cells[2].entries[0]).toMatchObject({ name: 'עובד זמני', color: '#13161D' })
  })

  it('shows a 12h assignment in its anchor cell with variant label and hour range, and marks the covered cell', () => {
    const view = makeView({
      twelve: [
        {
          day: 1,
          variant: 'm12_day',
          roleId: 'r-ahmash',
          employeeId: 'e2',
          fills: [
            { shift: 'morning', roleId: 'r-ahmash' },
            { shift: 'noon', roleId: 'r-ahmash' },
          ],
        },
      ],
    })
    const doc = buildImageDoc(view, 'w')
    const morning = doc.groups.find((g) => g.key === 'morning')!
    const noon = doc.groups.find((g) => g.key === 'noon')!
    const anchorCell = morning.rows[0].cells[1]
    expect(anchorCell.entries[0]).toEqual({
      name: 'יוסי לוי',
      color: '#B05AB5',
      is12h: true,
      variantName: 'יום 12ש׳',
      variantTime: '07:00–19:00',
    })
    const coveredCell = noon.rows[0].cells[1]
    expect(coveredCell.entries).toHaveLength(0)
    expect(coveredCell.covered).toBe(true)
  })

  it('computes row height from the tallest cell: stacked entries grow it, 12h adds a meta line', () => {
    const view = makeView({
      grid: { 0: { morning: { 'r-ahmash': ['e1', 'e2'] } } },
      twelve: [
        {
          day: 1,
          variant: 'm12_day',
          roleId: 'r-ahmash',
          employeeId: 'e2',
          fills: [{ shift: 'morning', roleId: 'r-ahmash' }, { shift: 'noon', roleId: 'r-ahmash' }],
        },
      ],
    })
    const doc = buildImageDoc(view, 'w')
    const row = doc.groups[0].rows[0]
    // Tallest cell is day 0 with two stacked base entries.
    const twoEntries = 2 * LINE_H + ENTRY_GAP + 2 * CELL_PAD_V
    const twelveCell = LINE_H + TWELVE_META_H + 2 * CELL_PAD_V
    expect(row.height).toBe(Math.max(ROW_MIN, twoEntries, twelveCell))
    // Empty rows fall back to the minimum height.
    const emptyRow = doc.groups[2].rows[1]
    expect(emptyRow.height).toBe(ROW_MIN)
  })

  it('group height is the sum of its row heights; doc height hugs the content exactly', () => {
    const doc = buildImageDoc(makeView(), 'w')
    for (const g of doc.groups) {
      expect(g.height).toBe(g.rows.reduce((s, r) => s + r.height, 0))
    }
    expect(doc.width).toBe(1200)
    // No dead whitespace: height is exactly chrome + groups + dividers
    // (2 frame paddings, header, day header, 2 group dividers, 2px border).
    const groupsH = doc.groups.reduce((s, g) => s + g.height, 0)
    expect(doc.height).toBe(2 * FRAME_PAD + HEADER_H + DAY_HEADER_H + groupsH + 2 * GROUP_DIVIDER + 2)
    expect(doc.height).toBeLessThanOrEqual(2400)
  })

  it('zebra flag alternates per role row within each shift group', () => {
    const doc = buildImageDoc(makeView(), 'w')
    expect(doc.groups[0].rows.map((r) => r.zebraEven)).toEqual([true, false])
  })

  it('builds the week label from the first/last day dates plus the closing year', () => {
    const doc = buildImageDoc(makeView(), 'מוקד ראשי')
    expect(doc.weekLabel).toBe('19.7 – 25.7.2026')
    expect(doc.workplaceName).toBe('מוקד ראשי')
  })

  it('carries the shift meta name/time/color for the label column', () => {
    const doc = buildImageDoc(makeView(), 'w')
    const morning = doc.groups.find((g) => g.key === 'morning')!
    expect(morning.name).toBe('בוקר')
    expect(morning.time).toBe('07:00–15:00')
    expect(morning.color).toBe('#F2A93B')
  })
})
