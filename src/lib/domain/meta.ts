// Data-driven display meta for shifts & roles. Reads the workplace's own DB
// values (name/time/color/rank) and falls back to the seeded SHIFT_META/ROLE_META
// constants for the known keys — so renamed/retimed/added roles & shifts render
// correctly while existing workplaces look identical.
import { SHIFT_META, ROLE_META, type ShiftId, type RoleName } from './constants'

export interface ShiftDisplay {
  name: string
  time: string
  color: string
  soft: string
  start: number
  hours: number
}

export interface RoleDisplay {
  name: string
  color: string
  soft: string
  rank: number
}

function pad(h: number): string {
  return `${String(((h % 24) + 24) % 24).padStart(2, '0')}:00`
}

/** "07:00–15:00" from start hour + length. */
export function formatShiftTime(start: number, hours: number): string {
  return `${pad(start)}–${pad(start + hours)}`
}

/** Translucent overlay from a hex color (~14% alpha), for soft backgrounds. */
function softFromColor(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return `${color}24`
  return 'rgba(0,0,0,0.08)'
}

export interface ShiftRowLike {
  key: string
  name?: string | null
  start_hour?: number | null
  hours?: number | null
  color?: string | null
}

export function shiftMetaFromRow(row: ShiftRowLike): ShiftDisplay {
  const fb = SHIFT_META[row.key as ShiftId]
  const start = row.start_hour ?? fb?.start ?? 0
  const hours = row.hours ?? fb?.hours ?? 8
  const color = row.color ?? fb?.color ?? '#888888'
  return {
    name: row.name ?? fb?.name ?? row.key,
    time: formatShiftTime(start, hours),
    color,
    soft: fb?.soft ?? softFromColor(color),
    start,
    hours,
  }
}

export interface RoleRowLike {
  name: string
  color?: string | null
  rank?: number | null
}

export function roleMetaFromRow(row: RoleRowLike): RoleDisplay {
  const fb = ROLE_META[row.name as RoleName]
  const color = row.color ?? fb?.color ?? '#888888'
  return {
    name: row.name,
    color,
    soft: fb?.soft ?? softFromColor(color),
    rank: row.rank ?? fb?.rank ?? 1,
  }
}
