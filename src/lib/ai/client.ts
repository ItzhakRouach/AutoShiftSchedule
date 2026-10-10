/**
 * Server-only Claude client for the optional AI scheduling layer.
 *
 * Mirrors the shape of src/lib/guardpay/appwrite.ts: it NEVER throws, returns a
 * discriminated result with a typed error code, checks config up front, and
 * supports a fixture short-circuit for e2e that is ignored in production.
 *
 * Billing: the key must belong to the Console organization linked to the Max
 * plan (ItzhakRouach) so calls draw on the included monthly credit. When the
 * credit is exhausted the API returns a 400 about the credit balance and
 * requests simply stop — nothing is ever charged to the Claude subscription.
 * See docs/ai-scheduling.md.
 */
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

export const MODEL = 'claude-opus-5'

/** USD per million tokens for MODEL. */
const RATE = { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 } as const

export type AiErrorCode =
  | 'NO_KEY' // ANTHROPIC_API_KEY not set
  | 'NO_CREDIT' // monthly credit exhausted and no purchased balance
  | 'RATE_LIMITED'
  | 'REFUSED' // safety decline (stop_reason: 'refusal')
  | 'TRUNCATED' // hit max_tokens — output is incomplete, never use it
  | 'EMPTY' // no text block came back
  | 'BAD_SHAPE' // reply did not match the structured-output schema
  | 'CALL_FAILED'

export interface AiUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number
}

export type AiResult<T> = { ok: true; data: T; usage: AiUsage } | { ok: false; code: AiErrorCode }

/** Text returned in fake mode, so e2e assertions have something stable. */
export const FAKE_TEXT = '[AI_FAKE] תקציר לדוגמה לצורכי בדיקות.'

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export interface RawUsage {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

export function costUsd(u: RawUsage): number {
  return (
    ((u.input_tokens ?? 0) * RATE.input +
      (u.output_tokens ?? 0) * RATE.output +
      (u.cache_read_input_tokens ?? 0) * RATE.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * RATE.cacheWrite) /
    1_000_000
  )
}

export const toUsage = (u: RawUsage): AiUsage => ({
  inputTokens: u.input_tokens ?? 0,
  outputTokens: u.output_tokens ?? 0,
  cacheReadTokens: u.cache_read_input_tokens ?? 0,
  cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  costUsd: costUsd(u),
})

export const EMPTY_USAGE: AiUsage = {
  inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0,
}

export interface CallTextParams {
  /** Stable prefix — cached, so keep volatile content out of it. */
  system: string
  user: string
  maxTokens?: number
  /** low | medium | high | xhigh | max. Default medium: the main cost lever. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}

/**
 * One non-streaming text completion. Used by the explanation feature, where the
 * output is prose and no schema applies. Adaptive thinking is on (the default
 * on Opus 5); `effort` is how we trade quality against output tokens, which
 * dominate the per-run cost.
 */
export async function callText(params: CallTextParams): Promise<AiResult<string>> {
  // Fake mode is for e2e/unit only. A stray AI_FAKE=1 in production must never
  // silently fabricate a schedule explanation, so it is ignored there.
  if (process.env.AI_FAKE === '1') {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[ai] AI_FAKE=1 ignored in production')
    } else {
      return { ok: true, data: FAKE_TEXT, usage: EMPTY_USAGE }
    }
  }

  if (!isAiConfigured()) return { ok: false, code: 'NO_KEY' }

  try {
    const client = new Anthropic()
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: params.maxTokens ?? 4096,
      output_config: { effort: params.effort ?? 'medium' },
      system: [{ type: 'text', text: params.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: params.user }],
    })

    if (res.stop_reason === 'refusal') return { ok: false, code: 'REFUSED' }
    if (res.stop_reason === 'max_tokens') return { ok: false, code: 'TRUNCATED' }
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
    if (!text) return { ok: false, code: 'EMPTY' }
    return { ok: true, data: text, usage: toUsage(res.usage) }
  } catch (err) {
    return { ok: false, code: classify(err) }
  }
}

export function classify(err: unknown): AiErrorCode {
  if (err instanceof Anthropic.RateLimitError) return 'RATE_LIMITED'
  if (err instanceof Anthropic.BadRequestError) {
    // The credit-exhausted case arrives as a 400 mentioning the credit balance.
    return /credit balance/i.test(err.message) ? 'NO_CREDIT' : 'CALL_FAILED'
  }
  return 'CALL_FAILED'
}
