// Shared Zod shape for both join flows (new-account + current-user).
import { z } from 'zod'

export const baseJoinShape = {
  name: z
    .string()
    .min(2, 'שם חייב להכיל לפחות 2 תווים')
    .max(120, 'שם ארוך מדי (מקסימום 120 תווים)'),
  phone: z.string().min(1, 'יש להזין מספר טלפון'),
  employmentType: z.enum(['full', 'part', 'student'], { error: 'יש לבחור סוג משרה' }),
  observesShabbat: z.boolean(),
  observesHolidays: z.boolean(),
} as const

/** Raw observance/employment fields from a join FormData. */
export function readBaseJoinFields(formData: FormData) {
  return {
    name: ((formData.get('name') as string) ?? '').trim(),
    phone: ((formData.get('phone') as string) ?? '').trim(),
    employmentType: (formData.get('employmentType') as string) ?? 'full',
    observesShabbat: formData.get('observesShabbat') === 'true',
    observesHolidays: formData.get('observesHolidays') === 'true',
  }
}
