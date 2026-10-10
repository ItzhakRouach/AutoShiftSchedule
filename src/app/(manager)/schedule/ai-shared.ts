// Shared Hebrew error copy and metric shaping for the AI schedule actions.
// Kept separate so each action file stays well under the 200-line rule.
import type { AiErrorCode } from '@/lib/ai/client'
import type { ScheduleScore } from '@/lib/ai/score'

export const AI_ERRORS: Record<AiErrorCode, string> & {
  MANUAL_EDITS: string
  PUBLISHED: string
  NOTHING_TO_APPLY: string
} = {
  NO_KEY: 'תכונת ה-AI אינה מוגדרת (חסר מפתח API).',
  NO_CREDIT: 'נגמר הקרדיט החודשי ל-API. התכונה תהיה זמינה שוב במחזור החיוב הבא.',
  RATE_LIMITED: 'יותר מדי בקשות כרגע. נסו שוב בעוד רגע.',
  REFUSED: 'המודל סירב לנתח את הבקשה הזו.',
  TRUNCATED: 'התשובה מה-AI נקטעה. נסו שוב.',
  EMPTY: 'לא התקבלה תשובה. נסו שוב.',
  BAD_SHAPE: 'התשובה מה-AI הגיעה בפורמט שגוי. נסו שוב.',
  CALL_FAILED: 'שגיאה בפנייה ל-AI. נסו שוב.',
  MANUAL_EDITS:
    'יש עריכות ידניות בסידור. שיפור AI עובד רק על סידור אוטומטי נקי, כדי לא לדרוס את העריכות שלכם.',
  PUBLISHED: 'הסידור פורסם — אי אפשר לשנות אותו.',
  NOTHING_TO_APPLY: 'לא נמצא שיפור חוקי להחלה.',
}

/** The manager-facing subset of a score. The engine's internal diversity cost
 *  is deliberately omitted — it is a lexicographic number in the billions and
 *  means nothing to a human. */
export interface AiMetrics {
  filledSlots: number
  requiredSlots: number
  requestsSatisfied: number
  belowMinCount: number
  nightSpread: number
  nightImbalanceCount: number
  twelveHourCount: number
  managerRoleSpread: number
}

export const metricsOf = (s: ScheduleScore): AiMetrics => ({
  filledSlots: s.filledSlots,
  requiredSlots: s.requiredSlots,
  requestsSatisfied: s.requestsSatisfied,
  belowMinCount: s.belowMinCount,
  nightSpread: s.nightSpread,
  nightImbalanceCount: s.nightImbalanceCount,
  twelveHourCount: s.twelveHourCount,
  managerRoleSpread: s.managerRoleSpread,
})
