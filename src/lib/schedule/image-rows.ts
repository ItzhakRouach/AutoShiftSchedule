/**
 * Pure mapper: ScheduleView → ImageDoc, the exact rows/cells/heights the
 * schedule PNG renders. Mirrors the manager week table structure (shift groups
 * spanning role rows) by reusing the SAME grid helpers the table uses
 * (buildWeekGrid, coveredByTwelve) — so 12h anchoring/covering, temps and the
 * roles-per-shift filter match WeekTableBody by construction. No IO, no bidi —
 * strings stay in logical order (the Satori template reorders them).
 */
import { SHIFT_META, type ShiftId } from '@/lib/domain/constants'
import { shiftMetaFromRow } from '@/lib/domain/meta'
import type { ShiftKey } from '@/lib/scheduling/types'
import type { DayInfo, ScheduleView } from './view-types'
import { buildWeekGrid } from './week-table-data'
import { coveredByTwelve } from './week-table-twelve'

export interface ImageEntry {
  name: string
  color: string
  is12h: boolean
  variantName?: string
  variantTime?: string
}

export interface ImageCellData {
  entries: ImageEntry[]
  /** Cell is (partly) staffed by an adjacent 12h shift — shows a '12ש׳' hint when empty. */
  covered: boolean
}

export interface ImageRoleRow {
  roleName: string
  roleColor: string
  zebraEven: boolean
  height: number
  cells: ImageCellData[] // 7, day 0..6
}

export interface ImageShiftGroup {
  key: ShiftKey
  name: string
  time: string
  color: string
  height: number
  rows: ImageRoleRow[]
}

export interface ImageDoc {
  workplaceName: string
  weekLabel: string
  days: DayInfo[]
  groups: ImageShiftGroup[]
  width: number
  height: number
}

// Layout constants — exported so the height math is unit-testable and the
// Satori template stays in perfect sync with the computed pixel heights.
export const LINE_H = 20 // one entry name line
export const TWELVE_META_H = 14 // the variant+time second line of a 12h entry
export const ENTRY_GAP = 4
export const CELL_PAD_V = 10
export const ROW_MIN = 44
export const HEADER_H = 64
export const DAY_HEADER_H = 46
export const GROUP_DIVIDER = 3
export const FRAME_PAD = 16
export const IMAGE_W = 1200
const HEIGHT_MAX = 2400
const TABLE_BORDER = 1 // outer 1px frame border, top+bottom

const BASE_SHIFTS: ShiftKey[] = ['morning', 'noon', 'night']
const TEXT_COLOR = '#13161D'

function entryHeight(e: ImageEntry): number {
  return e.is12h ? LINE_H + TWELVE_META_H : LINE_H
}

function cellHeight(cell: ImageCellData): number {
  if (cell.entries.length === 0) return ROW_MIN
  const content = cell.entries.reduce((s, e) => s + entryHeight(e), 0)
  return Math.max(ROW_MIN, content + (cell.entries.length - 1) * ENTRY_GAP + 2 * CELL_PAD_V)
}

export function buildImageDoc(view: ScheduleView, workplaceName: string): ImageDoc {
  const weekGrid = buildWeekGrid(view)
  const coveredMap = coveredByTwelve(view)
  const empById = new Map(view.employees.map((e) => [e.id, e]))
  const orderedRoleIds = view.roles.map((r) => r.id)
  const roleById = new Map(view.roles.map((r) => [r.id, r]))

  const groups: ImageShiftGroup[] = BASE_SHIFTS.map((shift) => {
    const m = view.shiftMeta?.[shift] ?? shiftMetaFromRow({ key: shift })
    // Same filter as WeekTableBody: only roles required for this shift some day
    // this week; when nothing is configured, fall back to all roles.
    const reqForShift = orderedRoleIds.filter((rid) =>
      view.days.some((d) => (view.requirements[d.index]?.[shift]?.[rid] ?? 0) > 0),
    )
    const roleIds = reqForShift.length > 0 ? reqForShift : orderedRoleIds

    const rows: ImageRoleRow[] = roleIds.map((roleId, ri) => {
      const role = roleById.get(roleId)
      const cells: ImageCellData[] = view.days.map((d) => {
        const entries: ImageEntry[] = (weekGrid[d.index]?.[shift]?.[roleId] ?? []).map((en) => {
          const emp = empById.get(en.employeeId)
          const base: ImageEntry = {
            name: en.tempName ?? emp?.name ?? '?',
            color: en.tempName ? TEXT_COLOR : emp?.color ?? TEXT_COLOR,
            is12h: en.is12h,
          }
          if (en.is12h && en.variant) {
            const vm = SHIFT_META[en.variant as ShiftId]
            base.variantName = vm?.name ?? '12ש׳'
            base.variantTime = vm?.time
          }
          return base
        })
        const covered = (coveredMap.get(`${d.index}:${shift}:${roleId}`) ?? 0) > 0
        return { entries, covered }
      })
      const height = Math.max(...cells.map(cellHeight))
      return {
        roleName: role?.name ?? roleId,
        roleColor: role?.color ?? TEXT_COLOR,
        zebraEven: ri % 2 === 0,
        height,
        cells,
      }
    })

    return {
      key: shift,
      name: m.name,
      time: m.time,
      color: m.color,
      height: rows.reduce((s, r) => s + r.height, 0),
      rows,
    }
  })

  const lastDay = new Date(view.weekStart + 'T00:00:00')
  lastDay.setDate(lastDay.getDate() + 6)
  const weekLabel = `${view.days[0].date} – ${view.days[6].date}.${lastDay.getFullYear()}`

  // Height hugs the content exactly — no dead whitespace under the table.
  const raw =
    2 * FRAME_PAD +
    HEADER_H +
    DAY_HEADER_H +
    groups.reduce((s, g) => s + g.height, 0) +
    GROUP_DIVIDER * (groups.length - 1) +
    2 * TABLE_BORDER

  return {
    workplaceName,
    weekLabel,
    days: view.days,
    groups,
    width: IMAGE_W,
    height: Math.min(HEIGHT_MAX, raw),
  }
}
