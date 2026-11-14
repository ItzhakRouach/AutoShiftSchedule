/**
 * Scores a week's schedule the way the workplace owner judges it, so the
 * engine can be held to the schedules he actually published. Pure; used only by
 * the real-week acceptance tests.
 */
import { generateSchedule } from '../engine'
import type { EngineInput, EngineResult } from '../types'

export interface ScheduleRow {
  emp: string
  day: number
  /** 'morning' | 'noon' | 'night' | 'm12_day' | 'm12_night' | … */
  kind: string
  role?: string
  fills?: { shift: string; role: string }[]
}

export interface RealWeek {
  week: string
  /** True when the input is exactly what the engine saw; false for the older
   *  weeks, whose roster is reconstructed from who actually worked. */
  faithful: boolean
  input: EngineInput
  managerFinal: ScheduleRow[]
  /** Corrections to the recorded input that the owner confirmed. */
  adjustments?: string[]
  requests: { emp: string; day: number; isOff: boolean; preferred: string[] }[]
}

/** Base windows a shift kind counts toward (the app's coverage convention). */
const FILLS: Record<string, string[]> = {
  morning: ['morning'], noon: ['noon'], night: ['night'],
  m12_day: ['morning', 'noon'], m12_night: ['night'], m12_3to15: ['night', 'morning'], m12_15to3: ['noon', 'night'],
}
const NIGHT_KINDS = new Set(['night', 'm12_night', 'm12_15to3'])
/** Who is physically on site 19:00–23:00: an 8h noon, or a 12h that spans it. */
const ON_SITE_EVENING = new Set(['noon', 'm12_night', 'm12_15to3'])

export interface WeekScore {
  openCells: number
  /** Σ over days of noon positions reported filled with nobody on site
   *  19:00–23:00 — a 12h day worker counted toward noon with no night partner. */
  eveningShort: number
  twelveCount: number
  nightsByEmp: Record<string, number>
  /** max − min nights among workers who share the night load (see nightPool). */
  nightSpread: number
  nightMax: number
  requestsHonoured: number
  requestsAsked: number
}

/** Rows + filled-cell counts from an engine result. */
export function rowsFromResult(res: EngineResult): { rows: ScheduleRow[]; cells: Map<string, number> } {
  const rows: ScheduleRow[] = []
  const cells = new Map<string, number>()
  const twelveDays = new Set(res.twelveHourAssignments.map((t) => `${t.employeeId}:${t.day}`))
  for (const t of res.twelveHourAssignments) rows.push({ emp: t.employeeId, day: t.day, kind: t.variant })
  for (const [day, byShift] of Object.entries(res.grid)) {
    for (const [shift, byRole] of Object.entries(byShift)) {
      for (const [role, ids] of Object.entries(byRole)) {
        for (const emp of ids) {
          const key = `${day}:${shift}:${role}`
          cells.set(key, (cells.get(key) ?? 0) + 1)
          if (!twelveDays.has(`${emp}:${day}`)) rows.push({ emp, day: Number(day), kind: shift, role })
        }
      }
    }
  }
  return { rows, cells }
}

/** Filled-cell counts for the manager's published rows. */
export function cellsFromRows(rows: ScheduleRow[]): Map<string, number> {
  const cells = new Map<string, number>()
  for (const r of rows) {
    const fills = r.fills ?? (FILLS[r.kind] ?? [r.kind]).map((shift) => ({ shift, role: r.role ?? '' }))
    for (const f of fills) {
      const key = `${r.day}:${f.shift}:${f.role}`
      cells.set(key, (cells.get(key) ?? 0) + 1)
    }
  }
  return cells
}

/**
 * Workers the weekly night split applies to: not must-accept (they only get the
 * nights they ask for), allowed to work a night on at least one day, and
 * working at least three shifts in this schedule (a one- or two-shift week
 * cannot carry an equal share).
 */
export function nightPool(week: RealWeek, rows: ScheduleRow[]): string[] {
  const shifts = new Map<string, number>()
  for (const r of rows) shifts.set(r.emp, (shifts.get(r.emp) ?? 0) + 1)
  return week.input.employees
    .filter((e) => !e.mustAccept)
    .filter((e) => !e.availability || Object.values(e.availability).some((ks) => ks.includes('night')))
    .filter((e) => (shifts.get(e.id) ?? 0) >= 3)
    .map((e) => e.id)
}

export function scoreWeek(week: RealWeek, rows: ScheduleRow[], cells: Map<string, number>): WeekScore {
  let openCells = 0
  /** Per day: how many noon positions the schedule claims to have filled. */
  const noonClaimed: Record<number, number> = {}
  for (const [day, byShift] of Object.entries(week.input.requirements)) {
    for (const [shift, byRole] of Object.entries(byShift)) {
      for (const [role, count] of Object.entries(byRole as Record<string, number>)) {
        if (count <= 0) continue
        const have = cells.get(`${day}:${shift}:${role}`) ?? 0
        if (have < count) openCells++
        if (shift === 'noon') noonClaimed[Number(day)] = (noonClaimed[Number(day)] ?? 0) + Math.min(have, count)
      }
    }
  }

  // An open noon cell is already counted in openCells; this isolates the
  // dishonest case — a cell reported filled with nobody there after 19:00.
  let eveningShort = 0
  for (const [day, claimed] of Object.entries(noonClaimed)) {
    const onSite = rows.filter((r) => r.day === Number(day) && ON_SITE_EVENING.has(r.kind)).length
    eveningShort += Math.max(0, claimed - onSite)
  }

  const nightsByEmp: Record<string, number> = {}
  for (const r of rows) if (NIGHT_KINDS.has(r.kind)) nightsByEmp[r.emp] = (nightsByEmp[r.emp] ?? 0) + 1
  const pool = nightPool(week, rows).map((id) => nightsByEmp[id] ?? 0)
  const nightMax = pool.length ? Math.max(...pool) : 0
  const nightSpread = pool.length ? nightMax - Math.min(...pool) : 0

  let requestsHonoured = 0
  for (const q of week.requests) {
    const mine = rows.filter((r) => r.emp === q.emp && r.day === q.day)
    const covered = new Set(mine.flatMap((r) => FILLS[r.kind] ?? [r.kind]))
    if ((q.isOff && mine.length === 0) || q.preferred.some((k) => covered.has(k))) requestsHonoured++
  }

  return {
    openCells, eveningShort,
    twelveCount: rows.filter((r) => r.kind.startsWith('m12')).length,
    nightsByEmp, nightSpread, nightMax,
    requestsHonoured, requestsAsked: week.requests.length,
  }
}

/** The engine's score on a real week, with the 12h pass enabled. */
export function scoreEngine(week: RealWeek): WeekScore {
  const { rows, cells } = rowsFromResult(generateSchedule({ ...week.input, skipTwelve: false }))
  return scoreWeek(week, rows, cells)
}

/** The owner's published schedule for the same week, on the same scale. */
export function scoreManager(week: RealWeek): WeekScore {
  return scoreWeek(week, week.managerFinal, cellsFromRows(week.managerFinal))
}

/**
 * Cells the owner could only fill by putting someone in a role they don't hold.
 * The owner decided the engine must never do that, so these may stay open.
 */
export function ownerRoleBreaks(week: RealWeek): number {
  const byId = new Map(week.input.employees.map((e) => [e.id, e]))
  let n = 0
  for (const r of week.managerFinal) {
    const e = byId.get(r.emp)
    if (!e) continue
    const roles = r.fills ? r.fills.map((f) => f.role) : [r.role ?? '']
    n += roles.filter((role) => !e.roleIds.includes(role)).length
  }
  return n
}
