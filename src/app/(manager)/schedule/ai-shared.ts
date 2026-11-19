// Shared Hebrew error copy and metric shaping for the AI schedule actions.
// Kept separate so each action file stays well under the 200-line rule.
import type { AiErrorCode } from '@/lib/ai/client'
import type { ScheduleScore } from '@/lib/ai/score'
import type { ShiftKey } from '@/lib/scheduling/types'

export const AI_ERRORS: Record<AiErrorCode, string> & {
  PUBLISHED: string
  NOTHING_TO_APPLY: string
  STALE: string
  REVERT_STALE: string
  REVERT_ILLEGAL: string
} = {
  NO_KEY: 'תכונת ה-AI אינה מוגדרת (חסר מפתח API).',
  NO_CREDIT: 'נגמר הקרדיט החודשי ל-API. התכונה תהיה זמינה שוב במחזור החיוב הבא.',
  RATE_LIMITED: 'יותר מדי בקשות כרגע. נסו שוב בעוד רגע.',
  REFUSED: 'המודל סירב לנתח את הבקשה הזו.',
  TRUNCATED: 'התשובה מה-AI נקטעה. נסו שוב.',
  EMPTY: 'לא התקבלה תשובה. נסו שוב.',
  BAD_SHAPE: 'התשובה מה-AI הגיעה בפורמט שגוי. נסו שוב.',
  CALL_FAILED: 'שגיאה בפנייה ל-AI. נסו שוב.',
  PUBLISHED: 'הסידור פורסם — אי אפשר לשנות אותו.',
  NOTHING_TO_APPLY: 'לא נמצא שיפור חוקי להחלה.',
  STALE: 'הסידור השתנה מאז ההצעה, ולכן היא לא הוחלה. הריצו את בדיקת ה-AI שוב.',
  REVERT_ILLEGAL: 'אחרי עריכות שנעשו מאז, החזרת הסידור הקודם תפר כלל (מנוחה / משמרת אחת ביום / יום חופש). אפשר לתקן ידנית בטבלה.',
  REVERT_STALE: 'המשבצות ששינה ה-AI נערכו מאז, ולכן אי אפשר לבטל אוטומטית. אפשר לתקן ידנית בטבלה.',
}

/** One cell the AI proposes to change: `fromId` leaves it, `toId` takes it. */
export interface AiChange {
  day: number
  shift: ShiftKey
  /** Role NAME (the engine's role id). */
  role: string
  fromId: string
  toId: string
  why?: string
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
