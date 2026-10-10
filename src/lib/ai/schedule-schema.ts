// Structured-output schema for an AI schedule proposal.
//
// Deliberately flat and array-shaped: structured outputs are strictest with
// fully-required fields, and an array of {shift, role} avoids optional object
// keys entirely. `toProposal` converts the wire shape into what the validator
// consumes, so the schema can stay model-friendly without leaking into the
// validator.
import { z } from 'zod'
import type { Proposal } from './proposal-types'

const SHIFT = z.enum(['M', 'A', 'N'])
const DAY = z.number().int().min(0).max(6)

export const ProposalSchema = z.object({
  assignments: z.array(
    z.object({
      emp: z.string(),
      day: DAY,
      shift: SHIFT,
      role: z.string(),
    }),
  ),
  twelveHour: z.array(
    z.object({
      emp: z.string(),
      day: DAY,
      variant: z.enum(['m12_day', 'm12_night', 'm12_3to15', 'm12_15to3']),
      roles: z.array(z.object({ shift: SHIFT, role: z.string() })),
    }),
  ),
  notes: z.string(),
})

export type ProposalWire = z.infer<typeof ProposalSchema>

export function toProposal(wire: ProposalWire): Proposal {
  return {
    assignments: wire.assignments,
    twelveHour: wire.twelveHour.map((t) => ({
      emp: t.emp,
      day: t.day,
      variant: t.variant,
      roles: Object.fromEntries(t.roles.map((r) => [r.shift, r.role])),
    })),
    notes: wire.notes,
  }
}
