// Rebuild an engine FillState from the week's SAVED assignment rows.
//
// The AI improvement used to regenerate the engine's week and refuse outright
// when the manager had edited anything. Starting from the persisted rows
// instead means it improves the schedule the manager is actually looking at —
// manual edits, 12h blocks and temps included. Pure: the server action resolves
// ids to the engine's key space (role NAMES, shift keys) before calling this.
import type { EngineInput, ShiftKey, TwelveHourKey } from '@/lib/scheduling/types'
import type { FillState } from '@/lib/scheduling/dayfill'
import { emptyGrid } from '@/lib/scheduling/grid'
import { buildLotteryRanks } from '@/lib/scheduling/fill-rounds'
import { satisfiedCount } from '@/lib/scheduling/request-gate'
import { TWELVE_HOUR_FILLS } from '@/lib/scheduling/fallback'

/** Grid placeholder for an ad-hoc temp: it fills the slot for coverage, but is
 *  on no roster, so no swap can ever name it. */
export const TEMP_OCCUPANT = '__temp__'

export interface SavedRow {
  /** null for a temp row. */
  employeeId: string | null
  day: number
  /** base shift key, or a 12h variant key. */
  shiftKey: string
  roleName: string
  /** Resolved 12h fill plan (window → role name); null for 8h / legacy rows. */
  fills: { shift: ShiftKey; roleName: string }[] | null
}

const BASE = new Set<string>(['morning', 'noon', 'night'])

export function stateFromRows(input: EngineInput, rows: SavedRow[]): FillState {
  const st: FillState = {
    grid: emptyGrid(input),
    committed: {},
    satisfied: {},
    lotteryRank: buildLotteryRanks(input),
    twelve: [],
  }
  const onRoster = new Set(input.employees.map((e) => e.id))
  for (const e of input.employees) st.committed[e.id] = []

  const place = (row: SavedRow, shift: ShiftKey, roleName: string, variant?: TwelveHourKey) => {
    const byShift = st.grid[row.day]?.[shift]
    if (!byShift) return // day outside the week
    const cell = (byShift[roleName] ??= [])
    cell.push(row.employeeId ?? TEMP_OCCUPANT)
    if (row.employeeId && onRoster.has(row.employeeId)) {
      st.committed[row.employeeId].push({
        employeeId: row.employeeId, day: row.day, shift, roleId: roleName,
        ...(variant ? { is12h: true, variant } : {}),
      })
    }
  }

  for (const row of rows) {
    if (BASE.has(row.shiftKey)) {
      place(row, row.shiftKey as ShiftKey, row.roleName)
      continue
    }
    const variant = row.shiftKey as TwelveHourKey
    const windows = TWELVE_HOUR_FILLS[variant]
    if (!windows) continue
    const fills = row.fills ?? windows.map((shift) => ({ shift, roleName: row.roleName }))
    const rolesByShift: Partial<Record<ShiftKey, string>> = {}
    for (const f of fills) {
      place(row, f.shift, f.roleName, variant)
      rolesByShift[f.shift] = f.roleName
    }
    if (row.employeeId && onRoster.has(row.employeeId)) {
      st.twelve!.push({ employeeId: row.employeeId, day: row.day, variant, rolesByShift })
    }
  }

  for (const e of input.employees) st.satisfied[e.id] = satisfiedCount(input, e.id, st.committed[e.id])
  return st
}
