import { z } from 'zod'

export const createWorkplaceSchema = z.object({
  orgName: z.string().min(2, { message: 'שם הארגון חייב לפחות 2 תווים' }),
  workplaceName: z.string().min(2, { message: 'שם מקום העבודה חייב לפחות 2 תווים' }),
  timezone: z.string().default('Asia/Jerusalem'),
})

export type CreateWorkplaceInput = z.infer<typeof createWorkplaceSchema>
