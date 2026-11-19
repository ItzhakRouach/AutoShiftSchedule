// Server-only write side of the AI improvement: pinning short-key swaps to real
// ids, running them through the all-or-nothing `swap_assignments_batch` RPC,
// and the preview text. Kept out of the 'use server' file so none of it is client-callable.
import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import type { ProposedSwap, SwapCell } from '@/lib/ai/apply-swaps'
import { CODE_SHIFT } from '@/lib/ai/encode-week'
import { buildKeyMaps } from '@/lib/ai/keys'
import { swapRpcArgs, type DbSwap } from '@/lib/ai/swap-rows'
import type { AiChange } from './ai-shared'
import type { SavedWeek } from './ai-improve-load'

type Supabase = Awaited<ReturnType<typeof createClient>>

/** The real employee id + role name behind each short key of a swap. Short
 *  keys are positions in the roster, so a worker added during the 2-4 minute
 *  run would shift them; apply refuses unless they still resolve to these. */
export interface SwapPin {
  a: string
  b: string
  aRole: string
  bRole: string
}

export type PinnedSwap = ProposedSwap & { pin: SwapPin }

const WHY_MAX = 400

export function pinSwaps(week: SavedWeek, swaps: ProposedSwap[]): PinnedSwap[] {
  const maps = buildKeyMaps(week.input)
  return swaps.map((sw) => ({
    a: sw.a,
    b: sw.b,
    why: sw.why?.slice(0, WHY_MAX),
    pin: {
      a: maps.empId(sw.a.emp) ?? '', b: maps.empId(sw.b.emp) ?? '',
      aRole: maps.roleId(sw.a.role) ?? '', bRole: maps.roleId(sw.b.role) ?? '',
    },
  }))
}

export function pinsHold(week: SavedWeek, swaps: PinnedSwap[]): boolean {
  const maps = buildKeyMaps(week.input)
  const same = (c: SwapCell, emp: string, role: string) => maps.empId(c.emp) === emp && maps.roleId(c.role) === role
  return swaps.every((sw) => same(sw.a, sw.pin.a, sw.pin.aRole) && same(sw.b, sw.pin.b, sw.pin.bRole))
}

/** Each swap as its two changed cells, "who leaves → who takes it". */
export function describeChanges(swaps: PinnedSwap[]): AiChange[] {
  return swaps.flatMap((sw) => {
    const cell = (c: SwapCell, role: string, fromId: string, toId: string): AiChange => ({
      day: c.day, shift: CODE_SHIFT[c.shift], role, fromId, toId, why: sw.why,
    })
    return [cell(sw.a, sw.pin.aRole, sw.pin.a, sw.pin.b), cell(sw.b, sw.pin.bRole, sw.pin.b, sw.pin.a)]
  })
}

export type RunOutcome = 'ok' | 'stale' | 'error'

/**
 * Run every swap in ONE transaction (`swap_assignments_batch`): either all of
 * them are written or none. The function re-checks that each worker still
 * holds the expected 8h cell, so an edit made meanwhile aborts the batch as
 * 'stale' instead of being moved blindly.
 */
export async function runSwaps(supabase: Supabase, periodId: string, swaps: DbSwap[], mode: 'manual' | 'restore'): Promise<RunOutcome> {
  const p_swaps = swaps.map((sw) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { p_period, ...args } = swapRpcArgs(periodId, sw, mode)
    return args
  })
  const { error } = await supabase.rpc('swap_assignments_batch', { p_period: periodId, p_swaps })
  if (!error) return 'ok'
  // ai_swap_stale: a cell moved; 23505: a worker got another shift that day.
  return error.message?.includes('ai_swap_stale') || error.code === '23505' ? 'stale' : 'error'
}
