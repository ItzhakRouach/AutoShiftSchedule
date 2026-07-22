/** One shift in the IMPORT_WEEK payload — UTC instants built from Israel wall-clock. */
export interface GuardPayShift {
  start: string
  end: string
  isHoliday: boolean
  comment: string
}

export interface FindAccountOk {
  ok: true
  userId: string
  name: string
  email: string
}

export interface ImportWeekOk {
  ok: true
  deleted: number
  created: number
  totalAmount: number
}

export type GuardPayErrorCode =
  | 'NOT_FOUND'
  | 'NO_PREFS'
  | 'BAD_PAYLOAD'
  | 'UNAUTHORIZED'
  | 'BAD_TZ'
  | 'EXEC_FAILED'

export const GUARDPAY_ERROR_HE: Record<GuardPayErrorCode, string> = {
  NOT_FOUND: 'לא נמצא חשבון GuardPay עם האימייל הזה',
  NO_PREFS: 'החשבון נמצא, אבל ההגדרה הראשונית באפליקציית GuardPay לא הושלמה',
  BAD_PAYLOAD: 'שגיאה בנתוני הייבוא',
  UNAUTHORIZED: 'שגיאת הרשאה מול GuardPay',
  BAD_TZ: 'שגיאת תצורה בשרת GuardPay (אזור זמן)',
  EXEC_FAILED: 'החיבור ל-GuardPay נכשל, נסו שוב מאוחר יותר',
}
