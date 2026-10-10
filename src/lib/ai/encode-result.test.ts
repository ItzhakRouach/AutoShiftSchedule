// Terse digest of a finished EngineResult — the input to the Hebrew explanation.
import { describe, it, expect } from 'vitest'
import { encodeResult } from './encode-result'
import { encodeWeek } from './encode-week'
import { generateSchedule } from '@/lib/scheduling'
import { emp, input, reqFor, mergeReqs, GUARD, SHIFT_MGR } from '@/lib/scheduling/fixtures'

const section = (text: string, header: string) => {
  const ls = text.split('\n')
  const i = ls.findIndex((l) => l.startsWith(header))
  if (i === -1) return null
  const rest = ls.slice(i + 1)
  const end = rest.findIndex((l) => l.startsWith('# '))
  return (end === -1 ? rest : rest.slice(0, end)).filter(Boolean)
}

describe('encodeResult', () => {
  it('encodes the filled grid as emp|day|shift|role rows using short keys', () => {
    const inp = input({
      employees: [emp('u1', { roleIds: [GUARD] })],
      requirements: reqFor([0], 'night', GUARD, 1),
    })
    const res = generateSchedule(inp)
    const { maps } = encodeWeek(inp)
    const text = encodeResult(inp, res, maps)
    expect(section(text, '# GRID')).toEqual(['e0|0|N|R0'])
  })

  it('reports coverage and feasibility', () => {
    const inp = input({
      employees: [emp('u1', { roleIds: [GUARD] })],
      requirements: reqFor([0, 1], 'night', GUARD, 1),
    })
    const res = generateSchedule(inp)
    const { maps } = encodeWeek(inp)
    const text = encodeResult(inp, res, maps)
    // One guard cannot work two consecutive nights back-to-back on rest rules,
    // so this week is short — exactly the case the explanation must describe.
    expect(text).toContain('# COVERAGE')
    expect(text).toMatch(/filled=\d+\/\d+/)
    expect(text).toMatch(/# FEASIBILITY (ok|short|needs12h)/)
  })

  it('lists uncovered slots with the engine gap reason', () => {
    const inp = input({
      employees: [emp('u1', { roleIds: [GUARD] })],
      requirements: reqFor([0], 'night', SHIFT_MGR, 1), // nobody holds אחמ״ש
    })
    const res = generateSchedule(inp)
    const { maps } = encodeWeek(inp)
    const gaps = section(encodeResult(inp, res, maps), '# GAPS')
    expect(gaps).toHaveLength(1)
    expect(gaps![0]).toMatch(/^0\|N\|R\d\|1\|no_role$/)
  })

  it('reports per-employee stats including below-minimum and night counts', () => {
    const inp = input({
      employees: [emp('u1', { roleIds: [GUARD], minShifts: 5 })],
      requirements: reqFor([0], 'morning', GUARD, 1),
    })
    const res = generateSchedule(inp)
    const { maps } = encodeWeek(inp)
    const stats = section(encodeResult(inp, res, maps), '# STATS')
    // emp|shifts|nights|requestsSatisfied|belowMin
    expect(stats).toEqual(['e0|1|0|0|belowMin'])
  })

  it('omits empty sections rather than emitting bare headers', () => {
    const inp = input({
      employees: [emp('u1', { roleIds: [GUARD] })],
      requirements: reqFor([0], 'morning', GUARD, 1),
    })
    const res = generateSchedule(inp)
    const { maps } = encodeWeek(inp)
    const text = encodeResult(inp, res, maps)
    expect(text).not.toContain('# GAPS')
    expect(text).not.toContain('# OVERRIDDEN_OFF')
    expect(text).not.toContain('# NIGHT_IMBALANCE')
    expect(text).not.toContain('# TWELVE')
  })

  it('encodes 12h assignments with their variant', () => {
    const inp = input({
      employees: [emp('u1', { roleIds: [GUARD] }), emp('u2', { roleIds: [GUARD] })],
      requirements: mergeReqs(
        reqFor([0], 'morning', GUARD, 1),
        reqFor([0], 'noon', GUARD, 1),
        reqFor([0], 'night', GUARD, 1),
      ),
      settings: { minRestHours: 8, idealRestHours: 16, allow12hFallback: true },
    })
    const res = generateSchedule(inp)
    const { maps } = encodeWeek(inp)
    const text = encodeResult(inp, res, maps)
    if (res.twelveHourAssignments.length > 0) {
      const tw = section(text, '# TWELVE')
      expect(tw![0]).toMatch(/^e\d\|0\|m12_(day|night|3to15|15to3)\|/)
    }
  })
})
