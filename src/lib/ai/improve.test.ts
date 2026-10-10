// Orchestration of the improvement flow, with the proposer injected so the
// pipeline is covered with zero spend.
import { describe, it, expect, vi } from 'vitest'
import { improveSchedule, type SwapProposer } from './improve'
import { buildKeyMaps } from './keys'
import { emp, input, reqFor, mergeReqs, buildRequests, GUARD } from '@/lib/scheduling/fixtures'
import type { EngineInput } from '@/lib/scheduling/types'
import type { SwapsWire } from './improve-schema'

const week = (): EngineInput => {
  const employees = ['u1', 'u2', 'u3'].map((id) => emp(id, { roleIds: [GUARD] }))
  return input({
    employees,
    requirements: mergeReqs(
      reqFor([0, 1, 2], 'morning', GUARD, 1),
      reqFor([0, 1, 2], 'night', GUARD, 1),
    ),
    requests: buildRequests(employees, (id, day) =>
      id === 'u3' && day === 2 ? { preferred: ['morning'] } : {},
    ),
  })
}

const proposer = (wire: SwapsWire): SwapProposer =>
  vi.fn(async () => ({
    ok: true as const,
    data: { parsed: wire, raw: [] },
    usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.002 },
  }))

describe('improveSchedule', () => {
  it('never reduces coverage, whatever swaps are proposed', async () => {
    const i = week()
    const g = buildKeyMaps(i).roleKey(GUARD)!
    const nonsense: SwapsWire = {
      swaps: [
        { a: { emp: 'e99', day: 0, shift: 'M', role: g }, b: { emp: 'e0', day: 1, shift: 'N', role: g }, why: 'x' },
        { a: { emp: 'e0', day: 6, shift: 'A', role: g }, b: { emp: 'e1', day: 5, shift: 'M', role: g }, why: 'y' },
      ],
      notes: 'בדיקה',
    }
    const r = await improveSchedule(i, { propose: proposer(nonsense) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.score.filledSlots).toBe(r.data.baseScore.filledSlots)
    expect(r.data.applied).toBe(0)
    expect(r.data.rejected).toHaveLength(2)
  })

  it('reports the engine baseline alongside the improved week', async () => {
    const i = week()
    const r = await improveSchedule(i, { propose: proposer({ swaps: [], notes: '' }) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.baseScore.requiredSlots).toBe(6)
    expect(r.data.score.requiredSlots).toBe(6)
    expect(r.data.improved).toBe(false) // no swaps applied ⇒ identical
  })

  it('surfaces the model notes and per-swap reasons', async () => {
    const i = week()
    const g = buildKeyMaps(i).roleKey(GUARD)!
    const r = await improveSchedule(i, {
      propose: proposer({
        swaps: [{ a: { emp: 'e99', day: 0, shift: 'M', role: g }, b: { emp: 'e0', day: 0, shift: 'N', role: g }, why: 'כי' }],
        notes: 'סיכום',
      }),
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.notes).toBe('סיכום')
    expect(r.data.rejected[0].reason).toBe('unknown_employee')
  })

  it('propagates a failed call', async () => {
    const propose: SwapProposer = vi.fn(async () => ({ ok: false as const, code: 'NO_CREDIT' as const }))
    const r = await improveSchedule(week(), { propose })
    expect(r).toEqual({ ok: false, code: 'NO_CREDIT' })
  })

  it('passes usage through for cost accounting', async () => {
    const r = await improveSchedule(week(), { propose: proposer({ swaps: [], notes: '' }) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.usage.costUsd).toBeCloseTo(0.002, 6)
  })
})
