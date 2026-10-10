// Structured-output schema for AI-proposed swaps on an existing week.
import { z } from 'zod'

const Cell = z.object({
  emp: z.string(),
  day: z.number().int().min(0).max(6),
  shift: z.enum(['M', 'A', 'N']),
  role: z.string(),
})

export const SwapsSchema = z.object({
  swaps: z.array(z.object({ a: Cell, b: Cell, why: z.string() })),
  notes: z.string(),
})

export type SwapsWire = z.infer<typeof SwapsSchema>
