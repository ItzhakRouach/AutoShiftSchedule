import { z } from 'zod'

export const saveDayRequestSchema = z.object({
  periodId: z.string().uuid({ message: 'מזהה תקופה לא תקין' }),
  employeeId: z.string().uuid({ message: 'מזהה עובד לא תקין' }),
  dayOfWeek: z
    .number()
    .int()
    .min(0, { message: 'יום שבוע לא תקין' })
    .max(6, { message: 'יום שבוע לא תקין' }),
  isOff: z.boolean(),
  preferredShiftIds: z.array(z.string().uuid({ message: 'מזהה משמרת לא תקין' })),
})

export type SaveDayRequestInput = z.infer<typeof saveDayRequestSchema>

export const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

export const addVacationSchema = z
  .object({
    employeeId: z.string().uuid({ message: 'מזהה עובד לא תקין' }),
    dateFrom: z.string().regex(isoDateRegex, { message: 'תאריך התחלה לא תקין' }),
    dateTo: z.string().regex(isoDateRegex, { message: 'תאריך סיום לא תקין' }),
  })
  .refine((d) => d.dateTo >= d.dateFrom, {
    message: 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה',
    path: ['dateTo'],
  })

export type AddVacationInput = z.infer<typeof addVacationSchema>

/** Manager-initiated vacation for a worker, from the schedule requests view. */
export const managerAddVacationSchema = z
  .object({
    employeeId: z.string().uuid({ message: 'מזהה עובד לא תקין' }),
    dateFrom: z.string().regex(isoDateRegex, { message: 'תאריך התחלה לא תקין' }),
    dateTo: z.string().regex(isoDateRegex, { message: 'תאריך סיום לא תקין' }),
  })
  .refine((d) => d.dateTo >= d.dateFrom, {
    message: 'תאריך סיום לפני תאריך התחלה',
    path: ['dateTo'],
  })

export type ManagerAddVacationInput = z.infer<typeof managerAddVacationSchema>
