/**
 * What the "השלמה עם משמרות 12 שעות" run WOULD change, so the manager can see
 * it before it is saved (owner rule, 2026-11-14: 12h shifts are worked out
 * automatically but applied only after approval). Pure — compares the
 * period's current rows with the rows the 12h run would leave behind.
 */
import { TWELVE_HOUR_FILLS } from '@/lib/scheduling/fallback'
import type { OverriddenOff, Requirements, ShiftKey, TwelveHourKey } from '@/lib/scheduling/types'

export interface ProposalRow {
  employee_id: string | null
  day_of_week: number
  shift_type_id: string
  role_id: string
  twelve_fills?: { shift: ShiftKey; role_id: string }[] | null
}

export interface ProposalPair {
  employeeId: string
  name: string
  variant: string
  /** The roles it covers, without repeats (a 07–19 may be one role or two). */
  roles: string[]
}

export interface ProposalChange {
  employeeId: string
  name: string
  /** Shift key before / after; null = not working that day. */
  from: string | null
  to: string | null
}

export interface ProposalDay {
  day: number
  openBefore: number
  openAfter: number
  pairs: ProposalPair[]
  changes: ProposalChange[]
  /** Workers brought in on a day they asked off. */
  overrides: { employeeId: string; name: string; shift: string }[]
}

export interface TwelveProposal {
  openBefore: number
  openAfter: number
  twelveCount: number
  /** Only days where something changes, in week order. */
  days: ProposalDay[]
}

export interface ProposalInput {
  before: ProposalRow[]
  after: ProposalRow[]
  /** Week requirements keyed by day → shift key → role NAME (engine shape). */
  requirements: Requirements
  /** shift_type_id → key, base and 12h variants alike. */
  idToKey: Record<string, string>
  roleIdToName: Record<string, string>
  names: Record<string, string>
  overrides: OverriddenOff[]
}

const isTwelve = (key: string): key is TwelveHourKey => key in TWELVE_HOUR_FILLS

/** Open required cells per day for a set of rows. */
function openByDay(rows: ProposalRow[], inp: ProposalInput): Record<number, number> {
  const have = new Map<string, number>()
  for (const r of rows) {
    const key = inp.idToKey[r.shift_type_id]
    if (!key) continue
    const fills = r.twelve_fills?.length
      ? r.twelve_fills.map((f) => ({ shift: f.shift, role: inp.roleIdToName[f.role_id] }))
      : (isTwelve(key) ? TWELVE_HOUR_FILLS[key] : [key as ShiftKey]).map((shift) => ({ shift, role: inp.roleIdToName[r.role_id] }))
    for (const f of fills) {
      const k = `${r.day_of_week}:${f.shift}:${f.role}`
      have.set(k, (have.get(k) ?? 0) + 1)
    }
  }
  const out: Record<number, number> = {}
  for (const [day, byShift] of Object.entries(inp.requirements)) {
    let open = 0
    for (const [shift, byRole] of Object.entries(byShift)) {
      for (const [role, need] of Object.entries(byRole as Record<string, number>)) {
        if (need > 0 && (have.get(`${day}:${shift}:${role}`) ?? 0) < need) open++
      }
    }
    out[Number(day)] = open
  }
  return out
}

/** employee → day → shift key (temps, who have no employee, are skipped). */
function shiftOf(rows: ProposalRow[], idToKey: Record<string, string>): Map<string, string> {
  const m = new Map<string, string>()
  for (const r of rows) if (r.employee_id) m.set(`${r.employee_id}:${r.day_of_week}`, idToKey[r.shift_type_id] ?? '?')
  return m
}

export function buildTwelveProposal(inp: ProposalInput): TwelveProposal {
  const openB = openByDay(inp.before, inp)
  const openA = openByDay(inp.after, inp)
  const b = shiftOf(inp.before, inp.idToKey)
  const a = shiftOf(inp.after, inp.idToKey)
  const name = (id: string) => inp.names[id] ?? '?'
  const sum = (o: Record<number, number>) => Object.values(o).reduce((s, n) => s + n, 0)

  const days: ProposalDay[] = []
  for (let day = 0; day < 7; day++) {
    const ids = [...new Set([...b.keys(), ...a.keys()].filter((k) => k.endsWith(`:${day}`)).map((k) => k.split(':')[0]))].sort()
    const changes: ProposalChange[] = ids
      .map((id) => ({ employeeId: id, name: name(id), from: b.get(`${id}:${day}`) ?? null, to: a.get(`${id}:${day}`) ?? null }))
      .filter((c) => c.from !== c.to)
    const pairs: ProposalPair[] = inp.after
      .filter((r) => r.day_of_week === day && r.employee_id && isTwelve(inp.idToKey[r.shift_type_id] ?? ''))
      .map((r) => ({
        employeeId: r.employee_id!,
        name: name(r.employee_id!),
        variant: inp.idToKey[r.shift_type_id],
        roles: [...new Set((r.twelve_fills?.length ? r.twelve_fills.map((f) => f.role_id) : [r.role_id]).map((id) => inp.roleIdToName[id] ?? '?'))],
      }))
      .sort((x, y) => (x.variant === y.variant ? x.employeeId.localeCompare(y.employeeId) : x.variant === 'm12_day' ? -1 : 1))
    const overrides = inp.overrides
      .filter((o) => o.day === day)
      .map((o) => ({ employeeId: o.employeeId, name: name(o.employeeId), shift: o.shift }))
    if (changes.length === 0 && overrides.length === 0) continue
    days.push({ day, openBefore: openB[day] ?? 0, openAfter: openA[day] ?? 0, pairs, changes, overrides })
  }

  return {
    openBefore: sum(openB),
    openAfter: sum(openA),
    twelveCount: inp.after.filter((r) => isTwelve(inp.idToKey[r.shift_type_id] ?? '')).length,
    days,
  }
}
