'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { buildEngineInput } from '@/lib/schedule/build-input'
import { buildAssignmentRows } from '@/lib/schedule/persist-rows'
import { resultFromFillState } from '@/lib/scheduling'
import { runFillHardDaysAware } from '@/lib/scheduling/fill'
import { improveSchedule } from '@/lib/ai/improve'
import { applySwaps, type ProposedSwap } from '@/lib/ai/apply-swaps'
import { scoreSchedule } from '@/lib/ai/score'
import { isAiConfigured } from '@/lib/ai/client'
import { GENERIC_ERROR, MANUAL_SOURCES } from './run-actions-shared'
import { AI_ERRORS, type AiMetrics, metricsOf } from './ai-shared'

const periodSchema = z.string().uuid()

const cellSchema = z.object({
  emp: z.string().max(16),
  day: z.number().int().min(0).max(6),
  shift: z.enum(['M', 'A', 'N']),
  role: z.string().max(16),
})
const swapsSchema = z.array(z.object({ a: cellSchema, b: cellSchema, why: z.string().max(400).optional() })).max(40)

export interface AiImproveResult {
  ok: boolean
  error?: string
  /** Applied swaps, replayed server-side by `applyImproved`. */
  swaps?: ProposedSwap[]
  applied?: number
  rejected?: number
  improved?: boolean
  notes?: string
  before?: AiMetrics
  after?: AiMetrics
  costUsd?: number
  /** Manual/12h edits exist, so the regenerated base would not match. */
  staleEdits?: boolean
}

/** True when the period already holds 12h rows, so the base is rebuilt the same
 *  way the persisted schedule was generated. */
async function baseSkipTwelve(
  supabase: Awaited<ReturnType<typeof createClient>>,
  periodId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('assignments')
    .select('id')
    .eq('period_id', periodId)
    .not('twelve_fills', 'is', null)
    .limit(1)
  return (data ?? []).length === 0
}

async function hasManual(
  supabase: Awaited<ReturnType<typeof createClient>>,
  periodId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('assignments')
    .select('id')
    .eq('period_id', periodId)
    .in('source', MANUAL_SOURCES)
    .limit(1)
  return (data ?? []).length > 0
}

/**
 * Ask Claude for swaps that improve the engine's week. READ-ONLY — it writes
 * nothing. The returned swaps are re-validated from scratch by `applyImproved`,
 * so the client is never trusted with a schedule.
 */
export async function requestImprovement(periodId: string): Promise<AiImproveResult> {
  const parsed = periodSchema.safeParse(periodId)
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR }
  if (!isAiConfigured() && process.env.AI_FAKE !== '1') {
    return { ok: false, error: AI_ERRORS.NO_KEY }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: GENERIC_ERROR }

  const built = await buildEngineInput(supabase, parsed.data)
  if (!built || built.period.workplace_id !== workplace.id) return { ok: false, error: GENERIC_ERROR }
  if (await hasManual(supabase, parsed.data)) return { ok: false, staleEdits: true, error: AI_ERRORS.MANUAL_EDITS }

  const skipTwelve = await baseSkipTwelve(supabase, parsed.data)
  const res = await improveSchedule({ ...built.input, skipTwelve })
  if (!res.ok) return { ok: false, error: AI_ERRORS[res.code] }

  return {
    ok: true,
    swaps: res.data.accepted,
    applied: res.data.applied,
    rejected: res.data.rejected.length,
    improved: res.data.improved,
    notes: res.data.notes,
    before: metricsOf(res.data.baseScore),
    after: metricsOf(res.data.score),
    costUsd: res.usage.costUsd,
  }
}

/**
 * Persist the improvement. The swaps are the ONLY thing taken from the client,
 * and they are replayed through `applySwaps` against a freshly rebuilt
 * deterministic base — so every hard constraint and the improvement test are
 * re-checked here. A forged swap is simply rejected.
 */
export async function applyImproved(periodId: string, swaps: unknown): Promise<AiImproveResult> {
  const pid = periodSchema.safeParse(periodId)
  const sw = swapsSchema.safeParse(swaps)
  if (!pid.success || !sw.success) return { ok: false, error: GENERIC_ERROR }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: GENERIC_ERROR }

  const built = await buildEngineInput(supabase, pid.data)
  if (!built || built.period.workplace_id !== workplace.id) return { ok: false, error: GENERIC_ERROR }
  if (built.period.status === 'published') return { ok: false, error: AI_ERRORS.PUBLISHED }
  if (await hasManual(supabase, pid.data)) return { ok: false, staleEdits: true, error: AI_ERRORS.MANUAL_EDITS }

  const skipTwelve = await baseSkipTwelve(supabase, pid.data)
  const input = { ...built.input, skipTwelve }
  const st = runFillHardDaysAware(input, skipTwelve)
  const outcome = applySwaps(input, st, sw.data)
  if (outcome.applied === 0) return { ok: false, error: AI_ERRORS.NOTHING_TO_APPLY }

  const result = resultFromFillState(input, st)
  const rows = buildAssignmentRows(result, {
    periodId: pid.data,
    keyToShiftTypeId: built.keyToShiftTypeId,
    allKeyToShiftTypeId: built.allKeyToShiftTypeId,
    nameToRoleId: built.nameToRoleId,
    // We refuse to run at all when manual rows exist, so there is nothing to
    // preserve and a full replace is the correct, simplest semantics.
    preservedRows: [],
    replaceManual: true,
  })

  const del = await supabase.from('assignments').delete().eq('period_id', pid.data)
  if (del.error) return { ok: false, error: GENERIC_ERROR }
  if (rows.length > 0) {
    const ins = await supabase.from('assignments').insert(rows)
    if (ins.error) return { ok: false, error: GENERIC_ERROR }
  }
  revalidatePath('/schedule')

  return { ok: true, applied: outcome.applied, after: metricsOf(scoreSchedule(input, result)) }
}
