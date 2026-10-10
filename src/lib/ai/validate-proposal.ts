// THE safety gate between Claude and the schedule.
//
// A model-produced schedule is untrusted input. This replays every row through
// the engine's OWN checkers — `validateAssignment` (all 8 hard constraints) for
// 8h rows and `canTwelve` for 12h blocks — plus the structural checks the
// constraint layer deliberately does not cover: does the employee exist, is the
// slot actually required, and is it already full (`slotAtCapacity`).
//
// Rows are accepted incrementally, each checked against the rows already
// accepted. That makes the surviving set internally legal by construction: the
// relevant constraints (one-per-day, maxShifts, rest) are symmetric, so a row
// validated against its predecessors cannot be invalidated by its successors.
// Rejected rows are dropped rather than repaired, leaving a coverage gap the
// repair round or the deterministic engine fills.
//
// 12h blocks are processed FIRST, because a 12h claims a whole day. An accepted
// block is committed through the engine's own `commitTwelve`, so its grid rows
// and canonical record are byte-identical to what the engine would produce.
import type { DayMeta, EngineInput, ShiftKey, TwelveHourAssignment, TwelveHourKey } from '@/lib/scheduling/types'
import type { FillState } from '@/lib/scheduling/dayfill'
import { validateAssignment } from '@/lib/scheduling'
import { hardReason } from '@/lib/scheduling/diagnose'
import { emptyGrid } from '@/lib/scheduling/grid'
import { canTwelve } from '@/lib/scheduling/twelve-rules'
import { commitTwelve } from '@/lib/scheduling/twelve-plan'
import { TWELVE_HOUR_FILLS } from '@/lib/scheduling/fallback'
import { satisfiedCount } from '@/lib/scheduling/request-gate'
import { slotAtCapacity } from '@/lib/schedule/validate-edit-core'
import { CODE_SHIFT } from './encode-week'
import { buildKeyMaps } from './keys'
import type { Proposal, ValidationOutcome, Violation } from './proposal-types'

const VARIANTS: TwelveHourKey[] = ['m12_day', 'm12_night', 'm12_3to15', 'm12_15to3']

const emptyState = (input: EngineInput): FillState => {
  const st: FillState = { grid: emptyGrid(input), committed: {}, satisfied: {}, lotteryRank: {}, twelve: [] }
  input.employees.forEach((e, i) => {
    st.committed[e.id] = []
    st.satisfied[e.id] = 0
    st.lotteryRank[e.id] = i
  })
  return st
}

const required = (input: EngineInput, day: number, shift: ShiftKey, role: string): number =>
  input.requirements[day]?.[shift]?.[role] ?? 0

export function validateProposal(input: EngineInput, proposal: Proposal): ValidationOutcome {
  const maps = buildKeyMaps(input)
  const empById = new Map(input.employees.map((e) => [e.id, e]))
  const metaOf = new Map<number, DayMeta>(input.days.map((d) => [d.index, d]))
  const st = emptyState(input)
  const violations: Violation[] = []
  let accepted = 0

  const claimedDay = new Set<string>() // `${empId}|${day}`
  const reject = (v: Violation) => violations.push(v)

  // ---- 12h blocks first: a 12h owns the whole day ----
  for (const t of proposal.twelveHour ?? []) {
    const id = maps.empId(t.emp)
    const emp = id ? empById.get(id) : undefined
    const meta = metaOf.get(t.day)
    if (!emp || !id) { reject({ kind: 'unknown_employee', emp: t.emp, day: t.day }); continue }
    if (!VARIANTS.includes(t.variant as TwelveHourKey) || !meta) {
      reject({ kind: 'bad_variant', emp: t.emp, day: t.day, variant: t.variant }); continue
    }
    const variant = t.variant as TwelveHourKey
    if (claimedDay.has(`${id}|${t.day}`)) {
      reject({ kind: 'duplicate_day', emp: t.emp, day: t.day, variant }); continue
    }

    // Only the windows this variant COUNTS TOWARD may be filled (TWELVE_HOUR_FILLS),
    // so a day/night pair tiles the day without double-counting.
    const rolesByShift: TwelveHourAssignment['rolesByShift'] = {}
    let bad = false
    for (const shift of TWELVE_HOUR_FILLS[variant]) {
      const code = Object.keys(CODE_SHIFT).find((c) => CODE_SHIFT[c] === shift)!
      const roleKey = t.roles[code]
      if (!roleKey) continue
      const role = maps.roleId(roleKey)
      if (!role) { reject({ kind: 'unknown_role', emp: t.emp, day: t.day, role: roleKey, variant }); bad = true; break }
      if (!emp.roleIds.includes(role)) {
        reject({ kind: 'twelve_role_not_held', emp: t.emp, day: t.day, shift: code, role: roleKey, variant }); bad = true; break
      }
      const need = required(input, t.day, shift, role)
      if (need === 0) { reject({ kind: 'no_such_requirement', emp: t.emp, day: t.day, shift: code, role: roleKey, variant }); bad = true; break }
      if (slotAtCapacity(st.grid[t.day][shift][role].length, need)) {
        reject({ kind: 'slot_over_capacity', emp: t.emp, day: t.day, shift: code, role: roleKey, variant }); bad = true; break
      }
      rolesByShift[shift] = role
    }
    if (bad) continue
    if (Object.keys(rolesByShift).length === 0) {
      reject({ kind: 'twelve_covers_nothing', emp: t.emp, day: t.day, variant }); continue
    }
    const legal = canTwelve({
      emp, meta, variant,
      request: input.requests[id]?.[t.day] ?? { off: false, preferred: [] },
      current: st.committed[id],
      settings: input.settings,
      priorTail: input.priorWeekTail?.[id],
      nextHead: input.nextWeekHead?.[id],
    })
    if (!legal) { reject({ kind: 'twelve_illegal', emp: t.emp, day: t.day, variant }); continue }

    commitTwelve(st, st.twelve!, emp, t.day, variant, { rolesByShift, absorb: null })
    claimedDay.add(`${id}|${t.day}`)
    accepted++
  }

  // ---- plain 8h rows ----
  for (const a of proposal.assignments) {
    const id = maps.empId(a.emp)
    const emp = id ? empById.get(id) : undefined
    if (!emp || !id) { reject({ kind: 'unknown_employee', emp: a.emp, day: a.day }); continue }
    const shift = CODE_SHIFT[a.shift]
    const meta = metaOf.get(a.day)
    if (!shift || !meta) { reject({ kind: 'bad_shift', emp: a.emp, day: a.day, shift: a.shift }); continue }
    const role = maps.roleId(a.role)
    if (!role) { reject({ kind: 'unknown_role', emp: a.emp, day: a.day, shift: a.shift, role: a.role }); continue }

    const need = required(input, a.day, shift, role)
    if (need === 0) {
      reject({ kind: 'no_such_requirement', emp: a.emp, day: a.day, shift: a.shift, role: a.role }); continue
    }
    if (claimedDay.has(`${id}|${a.day}`)) {
      reject({ kind: 'duplicate_day', emp: a.emp, day: a.day, shift: a.shift, role: a.role }); continue
    }
    if (slotAtCapacity(st.grid[a.day][shift][role].length, need)) {
      reject({ kind: 'slot_over_capacity', emp: a.emp, day: a.day, shift: a.shift, role: a.role }); continue
    }
    // Checked before isAssignable so a role mismatch reports as itself rather
    // than being folded into a generic hard-constraint failure.
    if (!emp.roleIds.includes(role)) {
      reject({ kind: 'role_not_held', emp: a.emp, day: a.day, shift: a.shift, role: a.role }); continue
    }
    if (!validateAssignment(input, emp, meta, shift, role, st.committed[id])) {
      reject({
        kind: 'hard_constraint', emp: a.emp, day: a.day, shift: a.shift, role: a.role,
        reason: hardReason({
          emp, meta, shift, roleId: role,
          request: input.requests[id]?.[a.day] ?? { off: false, preferred: [] },
          current: st.committed[id],
          settings: input.settings,
          priorTail: input.priorWeekTail?.[id],
          nextHead: input.nextWeekHead?.[id],
        }),
      })
      continue
    }

    st.grid[a.day][shift][role].push(id)
    st.committed[id].push({ employeeId: id, day: a.day, shift, roleId: role })
    claimedDay.add(`${id}|${a.day}`)
    accepted++
  }

  for (const e of input.employees) {
    st.satisfied[e.id] = satisfiedCount(input, e.id, st.committed[e.id])
  }

  return { violations, state: st, accepted, rejected: violations.length }
}
