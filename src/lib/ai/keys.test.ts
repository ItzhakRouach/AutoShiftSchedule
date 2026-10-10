// Bidirectional short-key maps for the Claude prompt. Employee UUIDs and Hebrew
// role names are replaced by compact ASCII keys; the model's reply is translated
// back, and anything it invents must fail to resolve.
import { describe, it, expect } from 'vitest'
import { buildKeyMaps } from './keys'
import { emp, input, GUARD, SHIFT_MGR, DISPATCH } from '@/lib/scheduling/fixtures'

const inp = () =>
  input({
    employees: [
      emp('11111111-1111-4111-8111-111111111111', { roleIds: [SHIFT_MGR, GUARD] }),
      emp('22222222-2222-4222-8222-222222222222', { roleIds: [GUARD, DISPATCH] }),
    ],
    managerRoleId: SHIFT_MGR,
  })

describe('buildKeyMaps', () => {
  it('assigns stable compact keys to employees and roles', () => {
    const m = buildKeyMaps(inp())
    expect(m.empKey('11111111-1111-4111-8111-111111111111')).toBe('e0')
    expect(m.empKey('22222222-2222-4222-8222-222222222222')).toBe('e1')
    // Roles are keyed in a deterministic (sorted) order, not input order.
    expect(new Set(Object.values(m.roleKeys))).toEqual(new Set(['R0', 'R1', 'R2']))
  })

  it('round-trips every employee and role', () => {
    const i = inp()
    const m = buildKeyMaps(i)
    for (const e of i.employees) expect(m.empId(m.empKey(e.id)!)).toBe(e.id)
    for (const r of [GUARD, SHIFT_MGR, DISPATCH]) expect(m.roleId(m.roleKey(r)!)).toBe(r)
  })

  it('is deterministic across calls and independent of employee array order', () => {
    const a = buildKeyMaps(inp())
    const i2 = inp()
    i2.employees.reverse()
    const b = buildKeyMaps(i2)
    // Roles key off a sorted role universe, so they must match regardless.
    expect(b.roleKeys).toEqual(a.roleKeys)
  })

  it('refuses to resolve a key the model invented', () => {
    const m = buildKeyMaps(inp())
    expect(m.empId('e99')).toBeUndefined()
    expect(m.roleId('R42')).toBeUndefined()
    expect(m.empId('')).toBeUndefined()
    expect(m.empId('11111111-1111-4111-8111-111111111111')).toBeUndefined()
  })
})
