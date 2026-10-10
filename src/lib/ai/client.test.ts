// The Claude client's non-network behavior: config gating, fake mode, the
// production guard on fake mode, and cost arithmetic. No network in these tests.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { isAiConfigured, callText, costUsd, FAKE_TEXT } from './client'

const saved = { ...process.env }
afterEach(() => {
  process.env = { ...saved }
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('isAiConfigured', () => {
  it('is false without a key', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(isAiConfigured()).toBe(false)
  })
  it('is true with a key', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    expect(isAiConfigured()).toBe(true)
  })
})

describe('callText', () => {
  it('fails closed with NO_KEY rather than throwing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.AI_FAKE
    const r = await callText({ system: 's', user: 'u' })
    expect(r).toEqual({ ok: false, code: 'NO_KEY' })
  })

  it('short-circuits with a fixture when AI_FAKE=1, without a key', async () => {
    delete process.env.ANTHROPIC_API_KEY
    process.env.AI_FAKE = '1'
    vi.stubEnv('NODE_ENV', 'test')
    const r = await callText({ system: 's', user: 'u' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data).toBe(FAKE_TEXT)
      expect(r.usage.costUsd).toBe(0)
    }
  })

  it('ignores AI_FAKE in production so a stray flag cannot fake real output', async () => {
    delete process.env.ANTHROPIC_API_KEY
    process.env.AI_FAKE = '1'
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = await callText({ system: 's', user: 'u' })
    expect(r).toEqual({ ok: false, code: 'NO_KEY' }) // fell through, did not fake
    expect(warn).toHaveBeenCalled()
  })
})

describe('costUsd', () => {
  it('prices input and output at the Opus 5 rates', () => {
    // 1M input @ $5 + 1M output @ $25
    expect(costUsd({ input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(30, 6)
  })
  it('prices cache reads at a tenth and cache writes at 1.25x', () => {
    expect(costUsd({ cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.5, 6)
    expect(costUsd({ cache_creation_input_tokens: 1_000_000 })).toBeCloseTo(6.25, 6)
  })
  it('is 0 for an empty usage record', () => {
    expect(costUsd({})).toBe(0)
  })
})
