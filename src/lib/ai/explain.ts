// Hebrew explanation of a finished schedule — the half of the AI layer that
// cannot affect correctness: it reads an EngineResult and writes prose. It
// never produces assignments, so there is nothing to validate.
//
// The engine already computes every fact needed (gap reasons, overridden offs,
// below-minimum workers, night imbalance, 12h usage); it simply has no way to
// narrate them. See docs/ai-scheduling.md.
import type { EngineInput, EngineResult } from '@/lib/scheduling/types'
import { encodeWeek } from './encode-week'
import { encodeResult } from './encode-result'
import { DOMAIN_RULESET } from './ruleset'
import { callText, type AiResult } from './client'

const TASK = `המשימה: הסבר למנהל את הסידור שנוצר, בעברית, בקצרה ולעניין.

כסה רק את מה שרלוונטי לשבוע הזה:
1. משבצות שנשארו ריקות — למה, ומה המנהל יכול לשנות כדי לסגור אותן.
2. בקשות שלא אושרו — של מי, ולמה דווקא הן.
3. עובדים מתחת למינימום המשמרות שלהם.
4. חלוקת לילות לא שוויונית — מי נושא יותר או פחות מחלקו, ולמה.
5. שימוש במשמרות 12 שעות — למה היה הכרחי ומה החלופה.
6. חופשים שנדרסו (OVERRIDDEN_OFF) — עם מי צריך לתאם.

פורמט: כותרת קצרה לכל נושא רלוונטי, ואחריה 1-3 נקודות. דלג לגמרי על נושא שאין בו בעיה.
אם הסידור תקין ומלא — אמור זאת במשפט אחד ואל תמציא בעיות.`

export interface ExplainPrompt {
  system: string
  user: string
}

/** Pure: the exact prompt pair sent to Claude. `system` is byte-stable across
 *  weeks so it can be cached; everything volatile lives in `user`. */
export function buildExplainPrompt(input: EngineInput, result: EngineResult): ExplainPrompt {
  const { text: week, maps } = encodeWeek(input)
  return {
    system: `${DOMAIN_RULESET}\n\n${TASK}`,
    user: `${week}\n${encodeResult(input, result, maps)}`,
  }
}

export async function explainSchedule(
  input: EngineInput,
  result: EngineResult,
): Promise<AiResult<string>> {
  const { system, user } = buildExplainPrompt(input, result)
  // Prose output, no schema. `medium` effort: output tokens dominate cost and a
  // summary does not need deep reasoning.
  return callText({ system, user, maxTokens: 2048, effort: 'medium' })
}
