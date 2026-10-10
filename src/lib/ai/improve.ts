// Second-opinion generation, reframed as IMPROVEMENT of the engine's week.
//
// The engine produces a complete, legal, usually 100%-coverage schedule. The
// model is then asked only for SWAPS, each of which is re-checked against every
// hard constraint and kept only if the overall score strictly improves. The
// outcome is therefore never worse than the engine's own week — the floor is
// "no swaps applied, identical result".
//
// `propose` is injected so the pipeline is tested without network or spend.
import type { EngineInput, EngineResult } from '@/lib/scheduling/types'
import { resultFromFillState } from '@/lib/scheduling'
import { runFillHardDaysAware } from '@/lib/scheduling/fill'
import { fakeModeActive, EMPTY_USAGE, type AiResult } from './client'
import { callStructured, type StructuredOk } from './client-structured'
import { SwapsSchema, type SwapsWire } from './improve-schema'
import { buildImprovePrompt } from './improve-prompt'
import { applySwaps, type ProposedSwap, type SwapRejection } from './apply-swaps'
import { scoreSchedule, compareScores, type ScheduleScore } from './score'
import type Anthropic from '@anthropic-ai/sdk'

export type SwapProposer = (
  system: string,
  messages: Anthropic.MessageParam[],
) => Promise<AiResult<StructuredOk<SwapsWire>>>

/** e2e/unit fixture: a well-formed reply that proposes nothing, so the flow is
 *  exercised end to end without a paid call. */
const fakeProposer: SwapProposer = async () => ({
  ok: true,
  data: { parsed: { swaps: [], notes: '[AI_FAKE] לא הוצעו החלפות.' }, raw: [] },
  usage: EMPTY_USAGE,
})

const realProposer: SwapProposer = (system, messages) =>
  // The VISIBLE reply is short (a handful of swaps), but adaptive thinking also
  // draws on max_tokens — 8000 truncated the reply outright. Only tokens
  // actually produced are billed, so a generous cap costs nothing and avoids
  // throwing away a whole run. Streaming keeps the large cap safe.
  callStructured({ system, messages, schema: SwapsSchema, maxTokens: 32000, effort: 'high' })

export interface ImproveOutcome {
  /** The week after the accepted swaps. Never worse than `baseResult`. */
  result: EngineResult
  score: ScheduleScore
  /** The engine's own week, untouched, for side-by-side comparison. */
  baseResult: EngineResult
  baseScore: ScheduleScore
  improved: boolean
  applied: number
  /** Exactly the swaps that were kept — replayed by the apply action. */
  accepted: ProposedSwap[]
  rejected: { swap: ProposedSwap; reason: SwapRejection }[]
  notes: string
}

export interface ImproveOpts {
  propose?: SwapProposer
}

export async function improveSchedule(
  input: EngineInput,
  opts: ImproveOpts = {},
): Promise<AiResult<ImproveOutcome>> {
  const propose = opts.propose ?? (fakeModeActive() ? fakeProposer : realProposer)

  // The engine's week, kept pristine for comparison...
  const baseResult = resultFromFillState(input, runFillHardDaysAware(input, input.skipTwelve ?? false))
  const baseScore = scoreSchedule(input, baseResult)
  // ...and an independent state the swaps mutate.
  const st = runFillHardDaysAware(input, input.skipTwelve ?? false)

  const { system, user } = buildImprovePrompt(input, baseResult)
  const call = await propose(system, [{ role: 'user', content: user }])
  if (!call.ok) return call

  const outcome = applySwaps(input, st, call.data.parsed.swaps)
  const result = resultFromFillState(input, st)
  const score = scoreSchedule(input, result)

  return {
    ok: true,
    usage: call.usage,
    data: {
      result,
      score,
      baseResult,
      baseScore,
      improved: compareScores(score, baseScore) < 0,
      applied: outcome.applied,
      accepted: outcome.accepted,
      rejected: outcome.rejected,
      notes: call.data.parsed.notes,
    },
  }
}
