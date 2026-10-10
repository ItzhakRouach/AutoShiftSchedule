// The orchestration: propose → validate → repair → complete with the engine →
// score. The proposer is injected, so the whole pipeline is tested without a
// network call or a cent of spend.
import { describe, it, expect, vi } from 'vitest'
import { generateAiSchedule, type Proposer } from './generate'
import { buildKeyMaps } from './keys'
import { emp, input, reqFor, mergeReqs, GUARD } from '@/lib/scheduling/fixtures'
import type { EngineInput } from '@/lib/scheduling/types'
import type { ProposalWire } from './schedule-schema'

const week = (): EngineInput =>
  input({
    employees: ['u1', 'u2', 'u3'].map((id) => emp(id, { roleIds: [GUARD] })),
    requirements: mergeReqs(
      reqFor([0, 1, 2], 'morning', GUARD, 1),
      reqFor([0, 1, 2], 'night', GUARD, 1),
    ),
  })

const wire = (assignments: ProposalWire['assignments']): ProposalWire => ({
  assignments,
  twelveHour: [],
  notes: 'בדיקה',
})

const proposerOf = (...replies: ProposalWire[]): Proposer => {
  let n = 0
  return vi.fn(async () => ({
    ok: true as const,
    data: { parsed: replies[Math.min(n++, replies.length - 1)], raw: [] },
    usage: { inputTokens: 10, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.001 },
  }))
}

describe('generateAiSchedule', () => {
  it('accepts a clean proposal, completes it and scores it', async () => {
    const i = week()
    const g = buildKeyMaps(i).roleKey(GUARD)!
    const propose = proposerOf(
      wire([
        { emp: 'e0', day: 0, shift: 'M', role: g },
        { emp: 'e1', day: 1, shift: 'M', role: g },
      ]),
    )
    const r = await generateAiSchedule(i, { propose })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.rounds).toBe(1)
    expect(r.data.violations).toEqual([])
    // Completion guarantees full coverage regardless of how little the AI placed.
    expect(r.data.score.filledSlots).toBe(r.data.score.requiredSlots)
    expect(r.data.notes).toBe('בדיקה')
  })

  it('runs a repair round when the first proposal has violations', async () => {
    const i = week()
    const g = buildKeyMaps(i).roleKey(GUARD)!
    const bad = wire([{ emp: 'e99', day: 0, shift: 'M', role: g }]) // unknown worker
    const good = wire([{ emp: 'e0', day: 0, shift: 'M', role: g }])
    const propose = proposerOf(bad, good)
    const r = await generateAiSchedule(i, { propose, maxRepairs: 2 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(propose).toHaveBeenCalledTimes(2)
    expect(r.data.rounds).toBe(2)
    expect(r.data.violations).toEqual([]) // the repaired round was clean
  })

  it('stops after maxRepairs and reports the residual violations', async () => {
    const i = week()
    const g = buildKeyMaps(i).roleKey(GUARD)!
    const alwaysBad = wire([{ emp: 'e99', day: 0, shift: 'M', role: g }])
    const propose = proposerOf(alwaysBad)
    const r = await generateAiSchedule(i, { propose, maxRepairs: 1 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(propose).toHaveBeenCalledTimes(2) // initial + 1 repair
    expect(r.data.violations.length).toBeGreaterThan(0)
    // Still a complete, legal schedule — the engine closed everything.
    expect(r.data.score.filledSlots).toBe(r.data.score.requiredSlots)
  })

  it('accumulates usage and cost across rounds', async () => {
    const i = week()
    const g = buildKeyMaps(i).roleKey(GUARD)!
    const propose = proposerOf(wire([{ emp: 'e99', day: 0, shift: 'M', role: g }]))
    const r = await generateAiSchedule(i, { propose, maxRepairs: 1 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.usage.costUsd).toBeCloseTo(0.002, 6)
    expect(r.usage.outputTokens).toBe(40)
  })

  it('propagates a failed call instead of inventing a schedule', async () => {
    const propose: Proposer = vi.fn(async () => ({ ok: false as const, code: 'NO_CREDIT' as const }))
    const r = await generateAiSchedule(week(), { propose })
    expect(r).toEqual({ ok: false, code: 'NO_CREDIT' })
  })

  it('also returns the pure engine result for side-by-side comparison', async () => {
    const i = week()
    const g = buildKeyMaps(i).roleKey(GUARD)!
    const r = await generateAiSchedule(i, { propose: proposerOf(wire([{ emp: 'e0', day: 0, shift: 'M', role: g }])) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.engineScore.requiredSlots).toBe(6)
    expect(typeof r.data.aiIsBetter).toBe('boolean')
  })
})
