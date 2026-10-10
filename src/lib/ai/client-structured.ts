// Structured-output variant of the Claude client: the model's reply is parsed
// against a Zod schema by the SDK, so the proposal arrives typed rather than as
// text we have to hand-parse. Split from client.ts to honour the ≤200-line rule.
//
// A schema-valid proposal is still UNTRUSTED — shape is not legality. Every row
// goes through validate-proposal.ts afterwards.
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'
import {
  MODEL, classify, toUsage, isAiConfigured, type AiResult,
} from './client'

export interface CallStructuredParams<S extends z.ZodType> {
  /** Stable prefix — cached, so keep volatile content out of it. */
  system: string
  /** Conversation turns. A repair round appends the prior reply + the violations. */
  messages: Anthropic.MessageParam[]
  schema: S
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}

export interface StructuredOk<T> {
  parsed: T
  /** The raw assistant turn, so a repair round can replay the conversation. */
  raw: Anthropic.ContentBlock[]
}

export async function callStructured<S extends z.ZodType>(
  params: CallStructuredParams<S>,
): Promise<AiResult<StructuredOk<z.infer<S>>>> {
  if (!isAiConfigured()) return { ok: false, code: 'NO_KEY' }
  try {
    const client = new Anthropic()
    // Streaming: a full week can be a long reply at a high max_tokens, and a
    // non-streaming request that large risks an HTTP timeout.
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: params.maxTokens ?? 16000,
      output_config: {
        effort: params.effort ?? 'high',
        format: zodOutputFormat(params.schema),
      },
      system: [{ type: 'text', text: params.system, cache_control: { type: 'ephemeral' } }],
      messages: params.messages,
    })
    const res = await stream.finalMessage()

    if (res.stop_reason === 'refusal') return { ok: false, code: 'REFUSED' }
    if (res.stop_reason === 'max_tokens') return { ok: false, code: 'TRUNCATED' }

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    if (!text.trim()) return { ok: false, code: 'EMPTY' }

    const parsed = params.schema.safeParse(JSON.parse(text))
    if (!parsed.success) return { ok: false, code: 'BAD_SHAPE' }

    return {
      ok: true,
      data: { parsed: parsed.data as z.infer<S>, raw: res.content },
      usage: toUsage(res.usage),
    }
  } catch (err) {
    // A schema-valid-looking reply that is not JSON lands here too.
    if (err instanceof SyntaxError) return { ok: false, code: 'BAD_SHAPE' }
    return { ok: false, code: classify(err) }
  }
}
