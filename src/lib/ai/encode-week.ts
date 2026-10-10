// Terse encoding of one week's EngineInput for the Claude prompt.
//
// Measured against the real week: 1,663 chars / 1,563 tokens, versus 11,931
// chars / 6,618 tokens for JSON.stringify(input) — a 76% token reduction. The
// reason to use it is NOT cost (output tokens dominate; see
// docs/ai-scheduling.md) but legibility: a narrow aligned table is far harder
// for the model to misread than deep JSON, and a mis-assignment costs more than
// tokens do.
//
// Pure & deterministic. Employee/role ids are short keys (see keys.ts), which
// doubles as the trust boundary on the way back.
import type { EngineInput, ShiftKey } from '@/lib/scheduling/types'
import { BASE_SHIFTS } from '@/lib/scheduling/types'
import { buildKeyMaps, type KeyMaps } from './keys'

/** Single-letter shift codes: בוקר / צהריים / לילה. */
export const SHIFT_CODE: Record<ShiftKey, string> = { morning: 'M', noon: 'A', night: 'N' }
export const CODE_SHIFT: Record<string, ShiftKey> = { M: 'morning', A: 'noon', N: 'night' }

const flag = (on: boolean, ch: string) => (on ? ch : '-')

function rosterLines(input: EngineInput, maps: KeyMaps): string[] {
  return input.employees.map((e) => {
    const avail = e.availability
      ? Object.keys(e.availability)
          .map(Number)
          .sort((a, b) => a - b)
          .map((d) => {
            const allowed = e.availability![d] ?? []
            const codes = BASE_SHIFTS.filter((s) => allowed.includes(s)).map((s) => SHIFT_CODE[s])
            return `${d}:${codes.join('')}`
          })
          .join(',')
      : '*'
    return [
      maps.empKey(e.id),
      e.roleIds.map((r) => maps.roleKey(r) ?? r).join('+'),
      e.employmentType[0],
      e.minShifts,
      e.maxShifts ?? '-',
      flag(e.observesShabbat, 'S'),
      flag(e.observesHolidays, 'H'),
      flag(e.mustAccept, 'A'),
      avail,
    ].join('|')
  })
}

function needLines(input: EngineInput, maps: KeyMaps): string[] {
  const out: string[] = []
  for (const d of Object.keys(input.requirements).map(Number).sort((a, b) => a - b)) {
    for (const sh of BASE_SHIFTS) {
      const byRole = input.requirements[d]?.[sh]
      if (!byRole) continue
      for (const role of Object.keys(byRole).sort()) {
        const n = byRole[role]
        if (n > 0) out.push(`${d}|${SHIFT_CODE[sh]}|${maps.roleKey(role) ?? role}|${n}`)
      }
    }
  }
  return out
}

function reqLines(input: EngineInput, maps: KeyMaps): string[] {
  const out: string[] = []
  for (const e of input.employees) {
    const byDay = input.requests[e.id]
    if (!byDay) continue
    for (const d of Object.keys(byDay).map(Number).sort((a, b) => a - b)) {
      const r = byDay[d]
      const wants = (r.preferred ?? []).length > 0
      if (!r.off && !r.offHard && !wants) continue // carries no information
      const off = r.offHard ? 'X' : r.off ? 'O' : '-'
      const codes = BASE_SHIFTS.filter((s) => (r.preferred ?? []).includes(s))
        .map((s) => SHIFT_CODE[s])
        .join('')
      out.push(`${maps.empKey(e.id)}|${d}|${off}|${codes}`)
    }
  }
  return out
}

export interface EncodedWeek {
  text: string
  maps: KeyMaps
}

export function encodeWeek(input: EngineInput): EncodedWeek {
  const maps = buildKeyMaps(input)
  const s = input.settings
  const mgr = input.managerRoleId ? (maps.roleKey(input.managerRoleId) ?? '-') : '-'
  const text = [
    '# ROSTER id|roles|type|min|max|shabbat|holidays|mustAccept|avail',
    ...rosterLines(input, maps),
    '# DAYS idx|holiday|holidayEve',
    ...input.days.map((d) => `${d.index}|${flag(d.isHoliday, 'H')}|${flag(d.isHolidayEve, 'E')}`),
    '# NEED day|shift|role|count',
    ...needLines(input, maps),
    '# REQ emp|day|off(O=soft,X=hard)|wants',
    ...reqLines(input, maps),
    `# SETTINGS minRest=${s.minRestHours} idealRest=${s.idealRestHours} allow12h=${s.allow12hFallback} mgrRole=${mgr}`,
  ].join('\n')
  return { text, maps }
}
