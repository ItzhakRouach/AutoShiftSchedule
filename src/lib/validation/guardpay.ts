import { z } from 'zod'

/** Optional manual email for the GuardPay link flow (auto-match uses the
 *  authenticated user's email when omitted). */
export const findAccountSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'כתובת אימייל לא תקינה' }).optional(),
})

export const syncWeekSchema = z.object({
  periodId: z.string().uuid({ message: 'מזהה שבוע לא תקין' }),
})

export type FindAccountInput = z.infer<typeof findAccountSchema>
export type SyncWeekInput = z.infer<typeof syncWeekSchema>
