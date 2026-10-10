// Terse digest of a finished EngineResult — what the Hebrew explanation reads.
//
// The engine already knows everything the manager wants explained: which slots
// stayed open and WHY (GapReason), whose off-request was overridden, who is
// below their minimum, who is carrying too many or too few nights, and which
// 12h blocks were used. It just has no way to say it in prose. This encoder
// hands all of that to the model in the same compact shape as encode-week.
//
// Empty sections are omitted entirely so the model never has to decide whether
// a bare header means "none" or "unknown". Pure & deterministic.
import type { EngineInput, EngineResult } from '@/lib/scheduling/types'
import { BASE_SHIFTS } from '@/lib/scheduling/types'
import { SHIFT_CODE } from './encode-week'
import type { KeyMaps } from './keys'

const sec = (header: string, rows: string[]): string[] =>
  rows.length > 0 ? [header, ...rows] : []

export function encodeResult(
  input: EngineInput,
  result: EngineResult,
  maps: KeyMaps,
): string {
  const e = (id: string) => maps.empKey(id) ?? id
  const r = (id: string) => maps.roleKey(id) ?? id

  // GRID — one row per committed assignment, canonically ordered.
  const grid: string[] = []
  for (const day of input.days.map((d) => d.index)) {
    for (const sh of BASE_SHIFTS) {
      const byRole = result.grid[day]?.[sh]
      if (!byRole) continue
      for (const role of Object.keys(byRole).sort()) {
        for (const empId of byRole[role]) {
          grid.push(`${e(empId)}|${day}|${SHIFT_CODE[sh]}|${r(role)}`)
        }
      }
    }
  }

  const gaps = result.warnings.map(
    (w) => `${w.day}|${SHIFT_CODE[w.shift]}|${r(w.roleId)}|${w.missing}|${w.reason ?? 'unknown'}`,
  )

  const twelve = result.twelveHourAssignments.map((t) => {
    const roles = BASE_SHIFTS.filter((s) => t.rolesByShift[s])
      .map((s) => `${SHIFT_CODE[s]}:${r(t.rolesByShift[s]!)}`)
      .join(',')
    return `${e(t.employeeId)}|${t.day}|${t.variant}|${roles}`
  })

  const overridden = result.overriddenOff.map(
    (o) => `${e(o.employeeId)}|${o.day}|${SHIFT_CODE[o.shift]}|${r(o.roleId)}`,
  )

  const nights = result.nightImbalance.map(
    (n) =>
      `${e(n.employeeId)}|${n.nights}|${n.nights < n.floor ? `below floor ${n.floor}` : `over target ${n.target}`}`,
  )

  const stats = input.employees.map((emp) => {
    const s = result.stats[emp.id]
    const parts = [
      e(emp.id),
      s?.shifts ?? 0,
      s?.byType.night ?? 0,
      s?.requestsSatisfied ?? 0,
    ]
    return `${parts.join('|')}${s?.belowMin ? '|belowMin' : ''}`
  })

  const c = result.coverage
  return [
    ...sec('# GRID emp|day|shift|role', grid),
    ...sec('# TWELVE emp|day|variant|roles', twelve),
    `# COVERAGE filled=${c.filledSlots}/${c.requiredSlots} (${c.percent}%)`,
    `# FEASIBILITY ${result.feasibility.status} ${result.feasibility.details}`,
    ...sec('# GAPS day|shift|role|missing|reason', gaps),
    ...sec('# OVERRIDDEN_OFF emp|day|shift|role', overridden),
    ...sec('# NIGHT_IMBALANCE emp|nights|note', nights),
    ...sec('# STATS emp|shifts|nights|requestsSatisfied|flags', stats),
  ].join('\n')
}
