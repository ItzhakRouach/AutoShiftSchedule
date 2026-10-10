// The explanation prompt is built purely, so it can be asserted without a call.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildExplainPrompt, explainSchedule } from './explain'
import { generateSchedule } from '@/lib/scheduling'
import { emp, input, reqFor, GUARD, SHIFT_MGR } from '@/lib/scheduling/fixtures'

const saved = { ...process.env }
afterEach(() => {
  process.env = { ...saved }
  vi.unstubAllEnvs()
})

const week = () => {
  const inp = input({
    employees: [emp('u1', { roleIds: [GUARD], minShifts: 5 })],
    requirements: reqFor([0], 'night', SHIFT_MGR, 1), // unfillable → a gap to explain
    managerRoleId: SHIFT_MGR,
  })
  return { inp, res: generateSchedule(inp) }
}

describe('buildExplainPrompt', () => {
  it('puts the stable ruleset in system and the week in user', () => {
    const { inp, res } = week()
    const p = buildExplainPrompt(inp, res)
    expect(p.system).toContain('אחמ״ש')          // domain ruleset, Hebrew-aware
    expect(p.system.length).toBeGreaterThan(500)
    expect(p.user).toContain('# ROSTER')          // the week
    expect(p.user).toContain('# GAPS')            // the result digest
  })

  it('keeps the volatile week OUT of the cached system prefix', () => {
    const a = buildExplainPrompt(week().inp, week().res)
    const other = input({
      employees: [emp('zz', { roleIds: [GUARD] })],
      requirements: reqFor([3], 'morning', GUARD, 1),
    })
    const b = buildExplainPrompt(other, generateSchedule(other))
    expect(b.system).toBe(a.system) // byte-identical ⇒ cacheable
    expect(b.user).not.toBe(a.user)
  })

  it('asks for Hebrew output and forbids inventing facts', () => {
    const p = buildExplainPrompt(week().inp, week().res)
    expect(p.system).toMatch(/עברית/)
    expect(p.system.toLowerCase()).toContain('do not invent')
  })
})

describe('explainSchedule', () => {
  it('returns the fixture under AI_FAKE without needing a key', async () => {
    delete process.env.ANTHROPIC_API_KEY
    process.env.AI_FAKE = '1'
    vi.stubEnv('NODE_ENV', 'test')
    const { inp, res } = week()
    const r = await explainSchedule(inp, res)
    expect(r.ok).toBe(true)
  })

  it('fails closed when unconfigured', async () => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.AI_FAKE
    const { inp, res } = week()
    const r = await explainSchedule(inp, res)
    expect(r).toEqual({ ok: false, code: 'NO_KEY' })
  })
})
