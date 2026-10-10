// Shapes for an AI-produced schedule proposal and the verdict on it.
// The proposal arrives in SHORT KEY space (e0 / R0 / M|A|N) exactly as the
// model emits it — resolution to real ids is part of validation, so an invented
// key is a violation rather than a crash.
import type { GapReason, TwelveHourKey } from '@/lib/scheduling/types'
import type { FillState } from '@/lib/scheduling/dayfill'

export interface ProposedAssignment {
  emp: string
  day: number
  shift: string
  role: string
}

export interface ProposedTwelve {
  emp: string
  day: number
  variant: string
  /** covered window code (M|A|N) → role short key */
  roles: Record<string, string>
}

export interface Proposal {
  assignments: ProposedAssignment[]
  twelveHour?: ProposedTwelve[]
  notes?: string
}

export type ViolationKind =
  | 'unknown_employee'
  | 'unknown_role'
  | 'bad_shift'
  | 'no_such_requirement'
  | 'duplicate_day'
  | 'slot_over_capacity'
  | 'role_not_held'
  | 'hard_constraint'
  | 'bad_variant'
  | 'twelve_role_not_held'
  | 'twelve_illegal'
  | 'twelve_covers_nothing'

/** One rejected row, in the model's own key space so it can be fed back for
 *  repair without translation. */
export interface Violation {
  kind: ViolationKind
  emp: string
  day: number
  shift?: string
  role?: string
  variant?: TwelveHourKey | string
  /** Which hard constraint failed, when `kind` is hard_constraint. */
  reason?: GapReason
}

export interface ValidationOutcome {
  /** Everything rejected. Empty ⇒ the proposal was fully legal. */
  violations: Violation[]
  /** Only the ACCEPTED rows — internally legal by construction. */
  state: FillState
  accepted: number
  rejected: number
}
