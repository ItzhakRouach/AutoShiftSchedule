// Server-only helpers for the AI improvement actions: load the week AS SAVED
// into engine state, and translate the model's short-key swaps into real-id
// swaps for the `swap_assignments` RPC. Kept out of the 'use server' file so
// none of this is callable from the client.
import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import { buildEngineInput, type BuiltInput } from '@/lib/schedule/build-input'
import { getWorkplaceShiftTypes } from '@/lib/schedule/shift-types-cache'
import { parseTwelveFills } from '@/lib/schedule/twelve-fills'
import { stateFromRows, type SavedRow } from '@/lib/ai/state-from-rows'
import { buildKeyMaps } from '@/lib/ai/keys'
import { CODE_SHIFT } from '@/lib/ai/encode-week'
import type { ProposedSwap, SwapCell } from '@/lib/ai/apply-swaps'
import type { DbSwap, RowSource, SwapSide } from '@/lib/ai/swap-rows'
import type { FillState } from '@/lib/scheduling/dayfill'
import type { EngineInput, ShiftKey } from '@/lib/scheduling/types'
import type { EngineSide } from '@/lib/ai/revert-check'

type Supabase = Awaited<ReturnType<typeof createClient>>

export interface DbRow {
  employee_id: string | null
  day_of_week: number
  shift_type_id: string
  role_id: string
  source: RowSource
  twelve_fills: unknown
}

export interface SavedWeek {
  built: BuiltInput
  input: EngineInput
  state: FillState
  rows: DbRow[]
  /** shift_type_id → shift key, and role_id → role name (engine key space). */
  shiftKeyById: Record<string, string>
  roleNameById: Record<string, string>
}

async function fetchRows(supabase: Supabase, periodId: string): Promise<DbRow[] | null> {
  const { data, error } = await supabase
    .from('assignments')
    .select('employee_id, day_of_week, shift_type_id, role_id, source, twelve_fills')
    .eq('period_id', periodId)
  return error ? null : ((data ?? []) as DbRow[])
}

/** The period's week as the manager sees it now, or null if it is not theirs. */
export async function loadSavedWeek(supabase: Supabase, periodId: string, workplaceId: string): Promise<SavedWeek | null> {
  const built = await buildEngineInput(supabase, periodId)
  if (!built || built.period.workplace_id !== workplaceId) return null
  const [{ keyById }, rows] = await Promise.all([
    getWorkplaceShiftTypes(supabase, workplaceId),
    fetchRows(supabase, periodId),
  ])
  if (!rows) return null

  const roleName: Record<string, string> = {}
  for (const [name, id] of Object.entries(built.nameToRoleId)) roleName[id] = name

  const saved: SavedRow[] = []
  for (const r of rows) {
    const shiftKey = keyById[r.shift_type_id]
    const role = roleName[r.role_id]
    if (!shiftKey || !role) continue
    const fills = parseTwelveFills(r.twelve_fills)
    const named = fills?.map((f) => ({ shift: f.shift, roleName: roleName[f.role_id] }))
    saved.push({
      employeeId: r.employee_id,
      day: r.day_of_week,
      shiftKey,
      roleName: role,
      fills: named && named.every((f) => f.roleName) ? named : null,
    })
  }
  const state = stateFromRows(built.input, saved)
  return { built, input: built.input, state, rows, shiftKeyById: keyById, roleNameById: roleName }
}

const BASE = new Set(['morning', 'noon', 'night'])

/** A DB swap in engine key space, for re-checking it with `revertLegal`.
 *  Null when a side is not a plain 8h cell (12h rows are never swap legs). */
export function toEngineSwap(week: SavedWeek, sw: DbSwap): { a: EngineSide; b: EngineSide } | null {
  const side = (s: SwapSide): EngineSide | null => {
    const shift = week.shiftKeyById[s.shiftTypeId]
    const role = week.roleNameById[s.roleId]
    if (!shift || !BASE.has(shift) || !role) return null
    return { employeeId: s.employeeId, day: s.day, shift: shift as ShiftKey, role }
  }
  const a = side(sw.a)
  const b = side(sw.b)
  return a && b ? { a, b } : null
}

/** Real-id form of accepted swaps, resolved against the week BEFORE any of
 *  them ran and advanced swap by swap, so chained swaps resolve correctly. */
export function toDbSwaps(week: SavedWeek, swaps: ProposedSwap[]): DbSwap[] | null {
  const maps = buildKeyMaps(week.input)
  const source = new Map<string, RowSource>()
  for (const r of week.rows) if (r.employee_id) source.set(`${r.employee_id}|${r.day_of_week}`, r.source)

  const side = (c: SwapCell): SwapSide | null => {
    const employeeId = maps.empId(c.emp)
    const role = maps.roleId(c.role)
    const shift = CODE_SHIFT[c.shift]
    const shiftTypeId = shift && week.built.keyToShiftTypeId[shift]
    const roleId = role && week.built.nameToRoleId[role]
    const src = employeeId && source.get(`${employeeId}|${c.day}`)
    if (!employeeId || !shiftTypeId || !roleId || !src) return null
    return { employeeId, day: c.day, shiftTypeId, roleId, source: src }
  }

  const out: DbSwap[] = []
  for (const sw of swaps) {
    const a = side(sw.a)
    const b = side(sw.b)
    if (!a || !b) return null
    out.push({ a, b })
    // After this swap each cell's source sits under its new occupant.
    source.delete(`${a.employeeId}|${a.day}`)
    source.delete(`${b.employeeId}|${b.day}`)
    source.set(`${a.employeeId}|${b.day}`, b.source)
    source.set(`${b.employeeId}|${a.day}`, a.source)
  }
  return out
}
