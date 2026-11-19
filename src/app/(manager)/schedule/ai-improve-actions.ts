'use server'

import { getAuthUser } from '@/lib/auth/user'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { improveSchedule } from '@/lib/ai/improve'
import { applySwaps } from '@/lib/ai/apply-swaps'
import { isAiConfigured } from '@/lib/ai/client'
import { cloneState } from '@/lib/ai/apply-swaps'
import { revertLegal } from '@/lib/ai/revert-check'
import { heldCells, planRevert, type DbSwap } from '@/lib/ai/swap-rows'
import { GENERIC_ERROR } from './run-actions-shared'
import { AI_ERRORS, type AiMetrics, type AiChange, metricsOf } from './ai-shared'
import { loadSavedWeek, toDbSwaps, toEngineSwap, type SavedWeek } from './ai-improve-load'
import { pinSwaps, pinsHold, describeChanges, runSwaps, type PinnedSwap } from './ai-improve-write'

const MAX_SWAPS = 40
const periodSchema = z.string().uuid()
const instructionSchema = z.string().max(500).optional()

const cellSchema = z.object({
  emp: z.string().max(16),
  day: z.number().int().min(0).max(6),
  shift: z.enum(['M', 'A', 'N']),
  role: z.string().max(16),
})
const pinSchema = z.object({ a: z.string().uuid(), b: z.string().uuid(), aRole: z.string().max(80), bRole: z.string().max(80) })
const swapsSchema = z
  .array(z.object({ a: cellSchema, b: cellSchema, why: z.string().max(400).optional(), pin: pinSchema }))
  .min(1)
  .max(MAX_SWAPS)

const sideSchema = z.object({
  employeeId: z.string().uuid(),
  day: z.number().int().min(0).max(6),
  shiftTypeId: z.string().uuid(),
  roleId: z.string().uuid(),
  // A swap leg is always an 8h row, which is never fallback_12h.
  source: z.enum(['auto', 'manual']),
})
const dbSwapsSchema = z.array(z.object({ a: sideSchema, b: sideSchema })).min(1).max(MAX_SWAPS)

export interface AiImproveResult {
  ok: boolean
  error?: string
  /** Accepted swaps, replayed and re-validated server-side by `applyImproved`. */
  swaps?: PinnedSwap[]
  /** Cell-by-cell preview of what the swaps change. */
  changes?: AiChange[]
  applied?: number
  rejected?: number
  notes?: string
  before?: AiMetrics
  after?: AiMetrics
  costUsd?: number
  /** What `revertImproved` needs to put the week back exactly as it was. */
  revert?: DbSwap[]
}

/** The manager's unpublished week as saved, or an error result. */
async function editableWeek(periodId: string): Promise<{ week: SavedWeek; supabase: Awaited<ReturnType<typeof createClient>> } | AiImproveResult> {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')
  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: GENERIC_ERROR }
  const week = await loadSavedWeek(supabase, periodId, workplace.id)
  if (!week) return { ok: false, error: GENERIC_ERROR }
  if (week.built.period.status === 'published') return { ok: false, error: AI_ERRORS.PUBLISHED }
  return { week, supabase }
}

/**
 * Ask Claude for swaps that improve the week AS SAVED — manual edits and 12h
 * blocks included. READ-ONLY: nothing is written until the manager approves.
 */
export async function requestImprovement(periodId: string, instruction?: string): Promise<AiImproveResult> {
  const pid = periodSchema.safeParse(periodId)
  const ask = instructionSchema.safeParse(instruction)
  if (!pid.success || !ask.success) return { ok: false, error: GENERIC_ERROR }
  if (!isAiConfigured() && process.env.AI_FAKE !== '1') return { ok: false, error: AI_ERRORS.NO_KEY }

  const ctx = await editableWeek(pid.data)
  if (!('week' in ctx)) return ctx
  const { week } = ctx

  const res = await improveSchedule(week.input, { state: week.state, instruction: ask.data })
  if (!res.ok) return { ok: false, error: AI_ERRORS[res.code] }
  // The prompt asks for 3-10; a reply past the apply cap could never be saved.
  if (res.data.applied > MAX_SWAPS) return { ok: false, error: AI_ERRORS.BAD_SHAPE }

  const swaps = pinSwaps(week, res.data.accepted)
  return {
    ok: true,
    swaps,
    changes: describeChanges(swaps),
    applied: res.data.applied,
    rejected: res.data.rejected.length,
    notes: res.data.notes,
    before: metricsOf(res.data.baseScore),
    after: metricsOf(res.data.score),
    costUsd: res.usage.costUsd,
  }
}

/**
 * Persist the approved swaps. Only the swaps come from the client, and they are
 * replayed through `applySwaps` against the week freshly loaded from the DB —
 * every hard constraint and the improvement test are re-checked. If the week or
 * roster changed since the preview so that not every swap still holds for the
 * same people, nothing is written: what is saved is exactly what was approved.
 */
export async function applyImproved(periodId: string, swaps: unknown): Promise<AiImproveResult> {
  const pid = periodSchema.safeParse(periodId)
  const sw = swapsSchema.safeParse(swaps)
  if (!pid.success || !sw.success) return { ok: false, error: GENERIC_ERROR }

  const ctx = await editableWeek(pid.data)
  if (!('week' in ctx)) return ctx
  const { week, supabase } = ctx
  if (!pinsHold(week, sw.data)) return { ok: false, error: AI_ERRORS.STALE }

  const outcome = applySwaps(week.input, cloneState(week.state), sw.data)
  if (outcome.applied === 0) return { ok: false, error: AI_ERRORS.NOTHING_TO_APPLY }
  if (outcome.applied !== sw.data.length) return { ok: false, error: AI_ERRORS.STALE }

  const dbSwaps = toDbSwaps(week, outcome.accepted)
  if (!dbSwaps) return { ok: false, error: AI_ERRORS.STALE }
  const run = await runSwaps(supabase, pid.data, dbSwaps, 'manual')
  if (run !== 'ok') return { ok: false, error: run === 'stale' ? AI_ERRORS.STALE : GENERIC_ERROR }
  revalidatePath('/schedule')
  return { ok: true, applied: outcome.applied, revert: dbSwaps }
}

/**
 * Put the week back exactly as it was before `applyImproved`. Refused when the
 * cells the AI touched were edited since, or when restoring them would now
 * break a hard rule (rest, one shift a day, day off) because of a later edit.
 */
export async function revertImproved(periodId: string, applied: unknown): Promise<AiImproveResult> {
  const pid = periodSchema.safeParse(periodId)
  const sw = dbSwapsSchema.safeParse(applied)
  if (!pid.success || !sw.success) return { ok: false, error: GENERIC_ERROR }

  const ctx = await editableWeek(pid.data)
  if (!('week' in ctx)) return ctx
  const { week, supabase } = ctx

  const plan = planRevert(heldCells(week.rows), sw.data)
  if (!plan) return { ok: false, error: AI_ERRORS.REVERT_STALE }
  const engine = plan.map((p) => toEngineSwap(week, p))
  if (engine.some((e) => !e)) return { ok: false, error: AI_ERRORS.REVERT_STALE }
  if (!revertLegal(week.input, cloneState(week.state), engine as NonNullable<(typeof engine)[number]>[])) {
    return { ok: false, error: AI_ERRORS.REVERT_ILLEGAL }
  }

  const run = await runSwaps(supabase, pid.data, plan, 'restore')
  if (run !== 'ok') return { ok: false, error: run === 'stale' ? AI_ERRORS.REVERT_STALE : GENERIC_ERROR }
  revalidatePath('/schedule')
  return { ok: true }
}
