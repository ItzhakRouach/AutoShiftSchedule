// Server-only write side of the AI improvement: pinning short-key swaps to real
// ids, running them through the atomic `swap_assignments` RPC, and the preview
// text. Kept out of the 'use server' file so none of it is client-callable.
import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import type { ProposedSwap, SwapCell } from '@/lib/ai/apply-swaps'
import { CODE_SHIFT } from '@/lib/ai/encode-week'
import { buildKeyMaps } from '@/lib/ai/keys'
import { swapRpcArgs, invertSwap, type DbSwap } from '@/lib/ai/swap-rows'
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

export interface RunOutcome {
  ok: boolean
  /** Swaps that are in the DB after this call and were not rolled back — on
   *  a failed rollback, what the manager still needs to be able to undo. */
  left: DbSwap[]
}

/**
 * Run the RPC once per swap (each call is its own transaction). On a failure,
 * the swaps already written are rolled back last-first; any whose rollback
 * also fails are reported in `left` so the UI can still offer the undo.
 */
export async function runSwaps(supabase: Supabase, periodId: string, swaps: DbSwap[], mode: 'manual' | 'restore'): Promise<RunOutcome> {
  const done: DbSwap[] = []
  for (const sw of swaps) {
    const { error } = await supabase.rpc('swap_assignments', swapRpcArgs(periodId, sw, mode))
    if (!error) { done.push(sw); continue }
    const left = [...done]
    for (const d of [...done].reverse()) {
      // The inverse restores the pre-swap rows, so it must restore sources too.
      const undo = await supabase.rpc('swap_assignments', swapRpcArgs(periodId, invertSwap(d), mode === 'manual' ? 'restore' : 'manual'))
      if (undo.error) break
      left.pop()
    }
    return { ok: false, left }
  }
  return { ok: true, left: done }
}
