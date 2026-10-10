// Second-opinion schedule generation: propose → validate → repair → complete
// with the engine → score against the engine's own week.
//
// The model never has the last word. Its rows are validated, the illegal ones
// are dropped, up to `maxRepairs` rounds let it fix them, and whatever is still
// open is closed by the engine. The outcome is therefore always a complete,
// hard-constraint-clean schedule — the AI only influences WHO goes where.
//
// `propose` is injected so the whole pipeline is testable without a network
// call; production passes the real structured-output client.
import type { EngineInput, EngineResult } from '@/lib/scheduling/types'
import { generateSchedule } from '@/lib/scheduling'
import type { AiResult, AiUsage } from './client'
import { callStructured, type StructuredOk } from './client-structured'
import { ProposalSchema, toProposal, type ProposalWire } from './schedule-schema'
import { buildGeneratePrompt, buildRepairUser } from './schedule-prompt'
import { validateProposal } from './validate-proposal'
import { completeWithEngine } from './complete-with-engine'
import { scoreSchedule, compareScores, type ScheduleScore } from './score'
import type { Violation } from './proposal-types'
import type Anthropic from '@anthropic-ai/sdk'

export type Proposer = (
  system: string,
  messages: Anthropic.MessageParam[],
) => Promise<AiResult<StructuredOk<ProposalWire>>>

const realProposer: Proposer = (system, messages) =>
  callStructured({ system, messages, schema: ProposalSchema, maxTokens: 32000, effort: 'high' })

export interface AiScheduleOutcome {
  /** The AI-seeded, engine-completed schedule. */
  result: EngineResult
  score: ScheduleScore
  /** The deterministic engine's own week, for side-by-side comparison. */
  engineResult: EngineResult
  engineScore: ScheduleScore
  aiIsBetter: boolean
  /** Rows still rejected after the last repair round (dropped, then filled by
   *  the engine). Empty ⇒ the model's final proposal was fully legal. */
  violations: Violation[]
  rounds: number
  notes: string
}

const ZERO: AiUsage = {
  inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0,
}

const add = (a: AiUsage, b: AiUsage): AiUsage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
  cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  costUsd: a.costUsd + b.costUsd,
})

export interface GenerateOpts {
  propose?: Proposer
  /** Extra attempts after the first. Default 1 — each costs a full round-trip. */
  maxRepairs?: number
}

export async function generateAiSchedule(
  input: EngineInput,
  opts: GenerateOpts = {},
): Promise<AiResult<AiScheduleOutcome>> {
  const propose = opts.propose ?? realProposer
  const maxRepairs = opts.maxRepairs ?? 1
  const { system, user } = buildGeneratePrompt(input)

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: user }]
  let usage = ZERO
  let rounds = 0
  let best: { outcome: ReturnType<typeof validateProposal>; notes: string } | null = null

  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    const call = await propose(system, messages)
    if (!call.ok) return rounds === 0 ? call : { ok: false, code: call.code }
    rounds++
    usage = add(usage, call.usage)

    const proposal = toProposal(call.data.parsed)
    const outcome = validateProposal(input, proposal)
    // Keep the attempt with the fewest rejections; a repair can come back worse.
    if (!best || outcome.violations.length < best.outcome.violations.length) {
      best = { outcome, notes: proposal.notes ?? '' }
    }
    if (outcome.violations.length === 0 || attempt === maxRepairs) break

    messages.push({ role: 'assistant', content: call.data.raw })
    messages.push({ role: 'user', content: buildRepairUser(outcome.violations, outcome.accepted) })
  }

  if (!best) return { ok: false, code: 'CALL_FAILED' }

  const result = completeWithEngine(input, best.outcome.state)
  const engineResult = generateSchedule(input)
  const score = scoreSchedule(input, result)
  const engineScore = scoreSchedule(input, engineResult)

  return {
    ok: true,
    usage,
    data: {
      result,
      score,
      engineResult,
      engineScore,
      aiIsBetter: compareScores(score, engineScore) < 0,
      violations: best.outcome.violations,
      rounds,
      notes: best.notes,
    },
  }
}
