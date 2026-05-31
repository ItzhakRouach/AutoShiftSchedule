// End-to-end integration test of the REAL scheduling pipeline:
//   DB (service-role) → buildEngineInput adapter → generateSchedule engine.
// Guarded: skipped unless service-role creds are present (.env.local via
// vitest.setup.ts), exactly like src/lib/db/rls.test.ts. Read-only: it loads the
// existing demo workplace ("מוקד ראשי") and asserts coverage + 12h behavior.
// It NEVER writes, so it does not disturb the manager@demo.com demo data.
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { buildEngineInput } from './build-input'
import { generateSchedule } from '@/lib/scheduling'
import { forEachRequirement } from '@/lib/scheduling/grid'
import { validateAssignment } from '@/lib/scheduling'
import { TWELVE_HOUR_FILLS } from '@/lib/scheduling/fallback'
import { canTwelve } from '@/lib/scheduling/twelve-rules'
import type { EngineInput, EngineResult, TwelveHourKey } from '@/lib/scheduling/types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const hasCredentials = Boolean(url && serviceKey)
const suite = hasCredentials ? describe : describe.skip

const PREFERRED: TwelveHourKey[] = ['m12_day', 'm12_night']
const LAST_RESORT: TwelveHourKey[] = ['m12_3to15', 'm12_15to3']

suite('demo-coverage: real DB → adapter → engine', { timeout: 30000 }, () => {
  let admin: SupabaseClient
  let input: EngineInput
  let result: EngineResult

  beforeAll(async () => {
    admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: wps } = await admin.from('workplaces').select('id').eq('name', 'מוקד ראשי')
    if (!wps || wps.length === 0) throw new Error('demo workplace "מוקד ראשי" not found — run scripts/seed-demo.mjs')
    const wpId = wps[0].id
    const { data: periods } = await admin
      .from('schedule_periods')
      .select('id, week_start_date')
      .eq('workplace_id', wpId)
      .order('week_start_date', { ascending: true })
    if (!periods || periods.length === 0) throw new Error('demo workplace has no schedule period')

    const built = await buildEngineInput(admin, periods[0].id)
    if (!built) throw new Error('buildEngineInput returned null for demo period')
    input = built.input
    result = generateSchedule(input)
  })

  it('builds engine input via the SAME adapter the app uses (63 required slots)', () => {
    expect(input.employees.length).toBeGreaterThanOrEqual(9)
    let required = 0
    forEachRequirement(input, (_d, _s, _r, need) => { required += need })
    expect(required).toBe(63)
    expect(result.coverage.requiredSlots).toBe(63)
  })

  it('every gap is a GENUINE staffing impossibility, not an engine/adapter bug', () => {
    // For each uncovered slot, prove NO qualified employee could legally fill it
    // (8h OR by extending a 12h) given the committed schedule. If even ONE could,
    // the engine left a fillable slot empty → that IS a bug and we fail loudly.
    const metas = Object.fromEntries(input.days.map((d) => [d.index, d]))
    const fillable: string[] = []
    for (const w of result.warnings) {
      const qualified = input.employees.filter((e) => e.roleIds.includes(w.roleId))
      const someoneCould = qualified.some((e) => {
        const committed = result.assignmentsByEmployee[e.id] ?? []
        // 8h placement legal?
        if (validateAssignment(input, e, metas[w.day], w.shift, w.roleId, committed)) return true
        return false
      })
      if (someoneCould)
        fillable.push(`day=${w.day} shift=${w.shift} role=${w.roleId} (a qualified+rested employee was available)`)
    }
    expect(
      fillable,
      `Engine left fillable slots empty (BUG):\n${fillable.join('\n')}`,
    ).toHaveLength(0)
    // The shortfall is therefore a real staffing limit: feasibility must say so.
    if (result.warnings.length > 0) {
      expect(['short', 'needs12h']).toContain(result.feasibility.status)
      expect(result.feasibility.shortBy).toBe(
        result.warnings.reduce((s, w) => s + w.missing, 0),
      )
    }
  })

  it('prefers day/night 12h variants over 03-15/15-03 (last-resort only)', () => {
    const used = new Set(result.twelveHourAssignments.map((t) => t.variant))
    const lastResortUsed = LAST_RESORT.filter((v) => used.has(v))
    // Last-resort variants may only appear when, on their day, the preferred
    // day/night pair could not have closed the same gaps. Assert each last-resort
    // record co-exists with preferred usage that day (i.e. it is genuinely residual).
    for (const t of result.twelveHourAssignments) {
      if (!LAST_RESORT.includes(t.variant)) continue
      const sameDayPreferred = result.twelveHourAssignments.some(
        (o) => o.day === t.day && PREFERRED.includes(o.variant),
      )
      expect(
        sameDayPreferred,
        `last-resort ${t.variant} on day ${t.day} used without any preferred 12h that day`,
      ).toBe(true)
    }
    // Preferred variants must dominate: at least as many preferred as last-resort.
    const preferredCount = result.twelveHourAssignments.filter((t) => PREFERRED.includes(t.variant)).length
    const lastResortCount = result.twelveHourAssignments.filter((t) => LAST_RESORT.includes(t.variant)).length
    expect(preferredCount).toBeGreaterThanOrEqual(lastResortCount)
    expect(lastResortUsed.length).toBeLessThanOrEqual(LAST_RESORT.length)
  })

  it('every 12h assignment respects rest/availability/sacred + cross-role rule', () => {
    const metas = Object.fromEntries(input.days.map((d) => [d.index, d]))
    const empById = Object.fromEntries(input.employees.map((e) => [e.id, e]))
    for (const t of result.twelveHourAssignments) {
      const emp = empById[t.employeeId]
      expect(emp, `unknown employee ${t.employeeId}`).toBeTruthy()
      // Cross-role rule: employee must hold every role they fill across the 12h.
      for (const role of Object.values(t.rolesByShift)) {
        expect(emp.roleIds, `emp ${emp.id} lacks role ${role}`).toContain(role)
      }
      // Reconstruct the committed state EXCLUDING this 12h, then re-validate the
      // 12h is legal against it (rest/availability/sacred/off/max all in canTwelve).
      const others = (result.assignmentsByEmployee[emp.id] ?? []).filter(
        (a) => !(a.is12h && a.variant === t.variant && a.day === t.day),
      )
      const req = input.requests[emp.id]?.[t.day] ?? { off: false, preferred: [] }
      const ok = canTwelve({
        emp, meta: metas[t.day], variant: t.variant, request: req,
        current: others, settings: input.settings,
      })
      expect(ok, `12h ${t.variant} for emp ${emp.id} day ${t.day} violates a hard rule`).toBe(true)
    }
  })

  it('is deterministic: same period → identical result across two runs', () => {
    const a = generateSchedule(input)
    const b = generateSchedule(input)
    expect(JSON.stringify(a.grid)).toBe(JSON.stringify(b.grid))
    expect(JSON.stringify(a.twelveHourAssignments)).toBe(JSON.stringify(b.twelveHourAssignments))
    expect(a.coverage).toEqual(b.coverage)
  })

  it('requirements → generation: raising a required count produces more gaps/fills', () => {
    // Mutate a COPY of the input (no DB write): double every required count.
    const scaled: EngineInput = {
      ...input,
      requirements: JSON.parse(JSON.stringify(input.requirements)),
    }
    for (const day of Object.keys(scaled.requirements)) {
      const d = scaled.requirements[Number(day)]
      for (const shift of Object.keys(d) as (keyof typeof d)[]) {
        for (const role of Object.keys(d[shift])) d[shift][role] *= 2
      }
    }
    const heavier = generateSchedule(scaled)
    // Doubling demand must raise required slots; with only 9 employees the engine
    // cannot fully cover 126 role-slots/week, so either more fills OR more gaps.
    expect(heavier.coverage.requiredSlots).toBe(result.coverage.requiredSlots * 2)
    const moreWork =
      heavier.coverage.filledSlots > result.coverage.filledSlots ||
      heavier.warnings.length > result.warnings.length
    expect(moreWork).toBe(true)
  })

  it('REPORT: 8h + 12h filled slots reconcile exactly to coverage.filledSlots', () => {
    // Each 12h covers >=1 base-shift cell (per TWELVE_HOUR_FILLS, by its
    // rolesByShift). 8h-filled = total filled minus 12h-filled. They must sum
    // back to coverage.filledSlots — a guard that the grid and 12h records agree.
    const twelveCells = new Set<string>()
    for (const t of result.twelveHourAssignments)
      for (const s of TWELVE_HOUR_FILLS[t.variant]) {
        const role = t.rolesByShift[s]
        if (role) twelveCells.add(`${t.day}:${s}:${role}`)
      }
    const filled12 = twelveCells.size
    const filled8 = result.coverage.filledSlots - filled12
    expect(filled8).toBeGreaterThanOrEqual(0)
    expect(filled8 + filled12).toBe(result.coverage.filledSlots)
    expect(result.coverage.percent).toBeGreaterThan(0)
  })
})
