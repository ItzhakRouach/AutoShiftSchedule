'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkplace } from '@/lib/workplace/current'
import { buildEngineInput } from '@/lib/schedule/build-input'
import { generateSchedule } from '@/lib/scheduling'
import { explainSchedule } from '@/lib/ai/explain'
import { encodeWeek } from '@/lib/ai/encode-week'
import { substituteNames } from '@/lib/ai/names'
import { isAiConfigured, type AiErrorCode } from '@/lib/ai/client'
import { GENERIC_ERROR } from './run-actions-shared'

export interface AiExplainResult {
  ok: boolean
  text?: string
  costUsd?: number
  /** True when the period holds manual/12h edits, which the explanation does
   *  not see (it describes the deterministic auto schedule). */
  staleEdits?: boolean
  error?: string
}

const ERRORS: Record<AiErrorCode, string> = {
  NO_KEY: 'תכונת ה-AI אינה מוגדרת (חסר מפתח API).',
  NO_CREDIT: 'נגמר הקרדיט החודשי ל-API. הסבר AI יהיה זמין שוב במחזור החיוב הבא.',
  RATE_LIMITED: 'יותר מדי בקשות כרגע. נסו שוב בעוד רגע.',
  REFUSED: 'המודל סירב לנתח את הבקשה הזו.',
  TRUNCATED: 'ההסבר נקטע באמצע. נסו שוב.',
  EMPTY: 'לא התקבל הסבר. נסו שוב.',
  CALL_FAILED: 'שגיאה בפנייה ל-AI. נסו שוב.',
  BAD_SHAPE: 'התשובה מה-AI הגיעה בפורמט שגוי. נסו שוב.',
}

const schema = z.object({ periodId: z.string().uuid() })

/**
 * Hebrew explanation of the week's schedule. READ-ONLY: it touches no table,
 * and the AI never produces assignments here — only prose about an
 * EngineResult the deterministic engine computed.
 *
 * The engine is deterministic (seed derived from the period id), so
 * regenerating reproduces the persisted auto schedule exactly. Manual/12h edits
 * are NOT reflected; `staleEdits` tells the UI to say so. Explaining the
 * persisted grid verbatim needs `resultFromFillState`, which arrives with the
 * second-opinion generator.
 */
export async function explainSchedulePeriod(periodId: string): Promise<AiExplainResult> {
  const parsed = schema.safeParse({ periodId })
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR }
  if (!isAiConfigured() && process.env.AI_FAKE !== '1') {
    return { ok: false, error: ERRORS.NO_KEY }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workplace = await getActiveWorkplace(supabase)
  if (!workplace) return { ok: false, error: GENERIC_ERROR }

  const built = await buildEngineInput(supabase, parsed.data.periodId)
  if (!built || built.period.workplace_id !== workplace.id) {
    return { ok: false, error: GENERIC_ERROR }
  }

  let result
  try {
    result = generateSchedule(built.input)
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }

  const res = await explainSchedule(built.input, result)
  if (!res.ok) return { ok: false, error: ERRORS[res.code] }

  const [{ data: emps }, { data: manual }] = await Promise.all([
    supabase.from('employees').select('id, name').eq('workplace_id', workplace.id),
    supabase
      .from('assignments')
      .select('id')
      .eq('period_id', parsed.data.periodId)
      .in('source', ['manual', 'fallback_12h'])
      .limit(1),
  ])
  const names = Object.fromEntries((emps ?? []).map((e) => [e.id, e.name]))
  const { maps } = encodeWeek(built.input)

  return {
    ok: true,
    text: substituteNames(res.data, maps, names),
    costUsd: res.usage.costUsd,
    staleEdits: (manual ?? []).length > 0,
  }
}
