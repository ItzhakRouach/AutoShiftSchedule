import { z } from 'zod'

export const employeeSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'שם חייב לפחות 2 תווים' })
    .max(120, { message: 'שם ארוך מדי (מקס׳ 120 תווים)' }),

  phone: z
    .string()
    .max(30, { message: 'מספר טלפון ארוך מדי' })
    .optional()
    .or(z.literal('')),

  minShifts: z
    .number()
    .int({ message: 'חייב להיות מספר שלם' })
    .min(0, { message: 'מינימום 0 משמרות' })
    .max(7, { message: 'מקסימום 7 משמרות בשבוע' }),

  observesShabbat: z.boolean(),
  observesHolidays: z.boolean(),
  mustAccept: z.boolean(),

  roleIds: z
    .array(z.string().uuid({ message: 'מזהה תפקיד לא תקין' }))
    .min(1, { message: 'יש לבחור לפחות תפקיד אחד' }),
})

export type EmployeeInput = z.infer<typeof employeeSchema>
