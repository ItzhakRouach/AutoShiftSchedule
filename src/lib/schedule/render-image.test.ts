import { writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { ScheduleView } from './view-types'
import type { ShiftKey } from '@/lib/scheduling/types'
import { renderSchedulePng } from './render-image'

/** Smoke test: the Satori template renders a real PNG for a small fixture —
 *  catches template regressions (undefined text nodes, unsupported CSS) that
 *  unit tests on the pure mapper cannot. */
function fixtureView(): ScheduleView {
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
      { id: 'r1', name: 'אחמ״ש', color: '#E0902A', rank: 3 },
      { id: 'r2', name: 'מאבטח', color: '#13A98E', rank: 1 },
    ],
    employees: [
      { id: 'e1', name: 'דנה כהן', color: '#3D6BF5' },
      { id: 'e2', name: 'יוסי לוי', color: '#B05AB5' },
    ],
    requirements: {},
    grid: { 0: { morning: { r1: ['e1'], r2: ['e2'] } } },
    twelve: [
      {
        day: 1,
        variant: 'm12_day',
        roleId: 'r1',
        employeeId: 'e2',
        fills: [
          { shift: 'morning', roleId: 'r1' },
          { shift: 'noon', roleId: 'r1' },
        ],
      },
    ],
    temps: [{ day: 2, shiftKey: 'noon', roleId: 'r2', assignmentId: 'a1', name: 'עובד זמני' }],
    shiftTypeIdByKey: { morning: 'st-m', noon: 'st-n', night: 'st-l' },
    hasAssignments: true,
    feasibility: null,
    requests: [],
    requestedSet: new Set(),
  }
}

describe('renderSchedulePng', () => {
  it('renders a valid PNG with content-derived dimensions', { timeout: 30000 }, async () => {
    const { png, width, height } = await renderSchedulePng(fixtureView(), 'מוקד ראשי')
    expect(width).toBe(1200)
    expect(height).toBeGreaterThanOrEqual(300)
    // PNG magic bytes
    expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(png.length).toBeGreaterThan(10_000)
    // Debug aid: DUMP_PNG=/path/out.png npx vitest run .../render-image.test.ts
    if (process.env.DUMP_PNG) await writeFile(process.env.DUMP_PNG, png)
  })
})
