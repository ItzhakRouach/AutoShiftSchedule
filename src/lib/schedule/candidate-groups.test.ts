import { describe, it, expect } from 'vitest'
import { groupCandidates, type GroupCandidatesView, type GroupCandidatesSlot } from './candidate-groups'
import type { EditMeta, EmployeeEditMeta } from './edit-meta'

const ROLE = 'r1'

function emp(over: Partial<EmployeeEditMeta> = {}): EmployeeEditMeta {
  return {
    id: 'x', roleIds: [ROLE], availability: null, offDays: [],
    preferred: {}, maxShifts: null, observesShabbat: false, committed: {}, absentDays: [], ...over,
  }
}

function build(employees: Record<string, EmployeeEditMeta>): EditMeta {
  return { minRestHours: 8, keyToShiftTypeId: {}, employees }
}

// Slot: Sunday (0), morning, role r1 — a non-Shabbat slot with no occupants.
const slot: GroupCandidatesSlot = { day: 0, shiftKey: 'morning', roleId: ROLE, assignedIds: [] }

const view: GroupCandidatesView = {
  employees: [
    { id: 'req', name: 'A', color: '#000' },
    { id: 'avail', name: 'B', color: '#000' },
    { id: 'wrongRole', name: 'C', color: '#000' },
    { id: 'assignedElsewhere', name: 'D', color: '#000' },
    { id: 'softOff', name: 'E', color: '#000' },
    { id: 'blocked', name: 'F', color: '#000' },
  ],
}

describe('groupCandidates', () => {
  const meta = build({
    req: emp({ id: 'req', preferred: { 0: ['morning'] } }),
    avail: emp({ id: 'avail' }),
    wrongRole: emp({ id: 'wrongRole', roleIds: [] }),
    assignedElsewhere: emp({ id: 'assignedElsewhere', committed: { 0: 'noon' } }),
    softOff: emp({ id: 'softOff', offDays: [0] }),
    // maxShifts reached on other days → hard "rest"/blocked.
    blocked: emp({ id: 'blocked', committed: { 1: 'morning', 2: 'morning' }, maxShifts: 1 }),
  })
  const g = groupCandidates(view, meta, slot)

  it('hides workers not eligible for the role', () => {
    expect(g.requested.concat(g.available, g.override, g.blocked).some((c) => c.id === 'wrongRole')).toBe(false)
  })

  it('hides workers already assigned elsewhere that day', () => {
    expect(g.requested.concat(g.available, g.override, g.blocked).some((c) => c.id === 'assignedElsewhere')).toBe(false)
  })

  it('buckets requested / available / override / blocked', () => {
    expect(g.requested.map((c) => c.id)).toEqual(['req'])
    expect(g.available.map((c) => c.id)).toEqual(['avail'])
    expect(g.override.map((c) => c.id)).toEqual(['softOff'])
    expect(g.blocked.map((c) => c.id)).toEqual(['blocked'])
  })

  it('counts only shown workers', () => {
    expect(g.shownCount).toBe(4)
  })

  it('skips current-cell occupants', () => {
    const g2 = groupCandidates(view, meta, { ...slot, assignedIds: ['avail'] })
    expect(g2.available.some((c) => c.id === 'avail')).toBe(false)
  })

  it('puts a worker on approved absence (מילואים) in blocked, never available', () => {
    const v = { employees: [{ id: 'onLeave', name: 'G', color: '#000' }] }
    const m = build({ onLeave: emp({ id: 'onLeave', absentDays: [0] }) })
    const gg = groupCandidates(v, m, slot)
    expect(gg.available).toHaveLength(0)
    expect(gg.blocked.map((c) => c.id)).toEqual(['onLeave'])
    expect(gg.blocked[0].label).toBe('בהיעדרות')
  })
})
