// The terse prompt encoding of one week (see docs/ai-scheduling.md). Chosen for
// readability-by-the-model, not token cost: 1,663 chars vs 11,931 for JSON.
import { describe, it, expect } from 'vitest'
import { encodeWeek } from './encode-week'
import { buildKeyMaps } from './keys'
import {
  emp, input, reqFor, mergeReqs, buildRequests, plainWeek, settings,
  GUARD, SHIFT_MGR,
} from '@/lib/scheduling/fixtures'

const line = (text: string, prefix: string) =>
  text.split('\n').find((l) => l.startsWith(prefix))
const section = (text: string, header: string) => {
  const ls = text.split('\n')
  const i = ls.findIndex((l) => l.startsWith(header))
  const rest = ls.slice(i + 1)
  const end = rest.findIndex((l) => l.startsWith('# '))
  return (end === -1 ? rest : rest.slice(0, end)).filter(Boolean)
}

describe('encodeWeek', () => {
  it('encodes a roster line with roles, type, bounds, flags and availability', () => {
    const e = emp('u1', {
      roleIds: [SHIFT_MGR, GUARD],
      employmentType: 'part',
      minShifts: 2,
      maxShifts: 4,
      observesShabbat: true,
      observesHolidays: true,
      mustAccept: true,
      availability: { 0: ['morning'], 2: ['morning', 'night'] },
    })
    const inp = input({ employees: [e], managerRoleId: SHIFT_MGR })
    const { text } = encodeWeek(inp)
    const m = buildKeyMaps(inp)
    const row = line(text, 'e0|')!
    expect(row).toContain(`${m.roleKey(SHIFT_MGR)}+${m.roleKey(GUARD)}`)
    expect(row).toContain('|p|2|4|')
    expect(row).toContain('|S|H|A|')
    expect(row).toContain('0:M,2:MN')
  })

  it('marks an unrestricted employee with * and a full-timer with -', () => {
    const inp = input({ employees: [emp('u1', { minShifts: 5, maxShifts: null })] })
    const row = line(encodeWeek(inp).text, 'e0|')!
    expect(row).toContain('|f|5|-|')   // no max
    expect(row).toContain('|-|-|-|*')  // no flags, unrestricted availability
  })

  it('lists only staffing requirements with a positive count', () => {
    const inp = input({
      employees: [emp('u1')],
      requirements: mergeReqs(reqFor([0], 'night', GUARD, 2), reqFor([1], 'morning', GUARD, 0)),
    })
    const { text } = encodeWeek(inp)
    const need = section(text, '# NEED')
    expect(need).toEqual(['0|N|R0|2'])
  })

  it('omits request rows that carry no information', () => {
    const employees = [emp('u1'), emp('u2')]
    const inp = input({
      employees,
      requests: buildRequests(employees, (id, day) => {
        if (id === 'u1' && day === 1) return { preferred: ['morning', 'night'] }
        if (id === 'u1' && day === 3) return { off: true }
        if (id === 'u2' && day === 5) return { offHard: true }
        return {}
      }),
    })
    const req = section(encodeWeek(inp).text, '# REQ')
    expect(req).toEqual(['e0|1|-|MN', 'e0|3|O|', 'e1|5|X|'])
  })

  it('encodes holidays and holiday eves', () => {
    const inp = input({
      employees: [emp('u1')],
      days: plainWeek([{}, { isHolidayEve: true }, { isHoliday: true }]),
    })
    const days = section(encodeWeek(inp).text, '# DAYS')
    expect(days[0]).toBe('0|-|-')
    expect(days[1]).toBe('1|-|E')
    expect(days[2]).toBe('2|H|-')
  })

  it('encodes settings including the manager role key', () => {
    const inp = input({
      employees: [emp('u1', { roleIds: [SHIFT_MGR] })],
      settings: settings({ minRestHours: 9, idealRestHours: 15, allow12hFallback: true }),
      managerRoleId: SHIFT_MGR,
    })
    const { text } = encodeWeek(inp)
    expect(line(text, '# SETTINGS')).toBe(
      '# SETTINGS minRest=9 idealRest=15 allow12h=true mgrRole=R0',
    )
  })

  it('omits the manager role when none is resolved (tied ranks)', () => {
    const inp = input({ employees: [emp('u1')] })
    expect(line(encodeWeek(inp).text, '# SETTINGS')).toContain('mgrRole=-')
  })

  it('returns the key maps it used, so the reply can be translated back', () => {
    const inp = input({ employees: [emp('u1'), emp('u2')] })
    const { maps } = encodeWeek(inp)
    expect(maps.empId('e1')).toBe('u2')
  })

  it('is far more compact than JSON and deterministic', () => {
    const employees = Array.from({ length: 12 }, (_, i) => emp(`u${i}`, { roleIds: [GUARD] }))
    const inp = input({
      employees,
      requirements: mergeReqs(
        reqFor([0, 1, 2, 3, 4, 5, 6], 'morning', GUARD, 2),
        reqFor([0, 1, 2, 3, 4, 5, 6], 'night', GUARD, 1),
      ),
    })
    const a = encodeWeek(inp).text
    expect(a).toBe(encodeWeek(inp).text)
    expect(a.length).toBeLessThan(JSON.stringify(inp).length / 2)
  })
})
