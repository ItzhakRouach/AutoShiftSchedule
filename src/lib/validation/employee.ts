import { z } from 'zod'

export const EMPLOYMENT_TYPES = ['full', 'part', 'student'] as const
export type EmploymentType = typeof EMPLOYMENT_TYPES[number]

export const availabilityItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  shiftTypeId: z.string().uuid({ message: 'מזהה סוג משמרת לא תקין' }),
})

export type AvailabilityItem = z.infer<typeof availabilityItemSchema>

export const employeeSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'שם חייב לפחות 2 תווים' })
    .max(120, { message: 'שם ארוך מדי (מקס׳ 120 תווים)' }),

  phone: z
    .string()
    .min(1, { message: 'יש להזין מספר טלפון' })
    .max(30, { message: 'מספר טלפון ארוך מדי' }),

  minShifts: z
    .number()
    .int({ message: 'חייב להיות מספר שלם' })
    .min(0, { message: 'מינימום 0 משמרות' })
    .max(7, { message: 'מקסימום 7 משמרות בשבוע' }),

  maxShifts: z
    .number()
    .int({ message: 'חייב להיות מספר שלם' })
    .min(0, { message: 'מינימום 0 משמרות' })
    .max(7, { message: 'מקסימום 7 משמרות בשבוע' })
    .nullable(),

  employmentType: z.enum(EMPLOYMENT_TYPES, {
    message: 'סוג העסקה לא תקין',
  }),

  observesShabbat: z.boolean(),
  observesHolidays: z.boolean(),
  mustAccept: z.boolean(),

  roleIds: z
    .array(z.string().uuid({ message: 'מזהה תפקיד לא תקין' }))
    .min(1, { message: 'יש לבחור לפחות תפקיד אחד' }),

  // Subset of roleIds the employee is SENIOR (priority) for. Optional.
  seniorRoleIds: z
    .array(z.string().uuid({ message: 'מזהה תפקיד לא תקין' }))
    .optional()
    .default([]),

  // availability: null/empty = unrestricted; otherwise a list of (day, shift) pairs
  availability: z.array(availabilityItemSchema).optional().nullable(),
})

export type EmployeeInput = z.infer<typeof employeeSchema>
