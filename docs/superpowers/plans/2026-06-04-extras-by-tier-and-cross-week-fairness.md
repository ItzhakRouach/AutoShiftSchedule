# Extras-by-Tier + Cross-Week Extras Fairness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Once all full-time employees reach their minimum, prefer part-time and student employees for remaining open slots (up to their `maxShifts`), and only after that distribute the residual extras to full-timers using a cross-week fairness signal so that "who got 6 last week" gets fewer extras this week.

**Architecture:** Two additions to the existing `src/lib/scheduling/` engine, both soft and coverage-preserving:
1. A new precedence step **4.5 "extras-by-tier"** sits between the ≥2-request floor (step 4) and `fairnessScore` (step 5) in `scoring.compareCandidates`. It applies ONLY when both candidates are at/above their minimum — among that bucket it reverses employment tier (part < student < full) so part-time/student win extras up to their `maxShifts`. Below-min logic in step 2 is untouched. The pre-pass `carryOverRound` in `fill.ts` stays minimum-only (no extras pre-pass).
2. A new per-employee carry-over signal `priorExtras = max(0, shiftsInPriorPublished − minShifts)` mirrors the existing `priorDeficit`. It is folded into `fairnessScore` with a dominant weight so a full-timer who already worked extras last week receives extras less often this week. The DB adapter (`build-input.ts computePriorExtras`) computes it from the same prior published period that `computePriorDeficit` already uses, costing zero extra round-trips.

**Tech Stack:** TypeScript (engine is pure TS), Vitest (unit), `@supabase/ssr` (adapter), no schema changes.

---

## File Structure

**Engine (pure TS, no I/O):**
- Modify `src/lib/scheduling/types.ts` — add optional `priorExtras?: number` to `Employee`.
- Modify `src/lib/scheduling/fairness.ts` — extend `fairnessScore` to accept the candidate's `priorExtras` and weight it above `load`.
- Modify `src/lib/scheduling/scoring.ts` — add `extrasTierRank`, `priorExtrasOf`, and step 4.5 to `compareCandidates`. Pass `priorExtras` through to `fairnessScore`.
- Modify `src/lib/scheduling/fixtures.ts` — let `emp(...)` accept `priorExtras` (mirrors `priorDeficit`).
- Create `src/lib/scheduling/extras-tier.test.ts` — verifies step 4.5 behaviour.
- Create `src/lib/scheduling/prior-extras.test.ts` — verifies `priorExtras` cross-week fairness in `fairnessScore` and end-to-end via `generateSchedule`.
- Modify `src/lib/scheduling/fairness.test.ts` (if it exists) — add `priorExtras` term coverage.

**DB adapter (Supabase-aware):**
- Modify `src/lib/schedule/build-input.ts` — add `computePriorExtras`, run it in parallel with `computePriorDeficit` against the same `prior` row, pass result into `mapToEngineInput`.
- Modify `src/lib/schedule/map-rows.ts` — accept `priorExtras` in `MapInput`, propagate to per-employee mapping (default 0).
- Create `src/lib/schedule/prior-extras.test.ts` — verifies the adapter against a fake DB client.

**Docs:**
- Modify `docs/scheduling-engine.md` — document step 4.5 in the precedence list, document `priorExtras` in the fairness section, update the "Consequence" paragraph.

Each task below is one focused change with a failing test, an implementation, a passing run, and a commit. The order is: types → fairness term → scoring step 4.5 → engine end-to-end test → adapter → docs.

---

## Task 1: Add `priorExtras` field to `Employee` type

**Files:**
- Modify: `src/lib/scheduling/types.ts:11-29`

This is a type-only change; no behaviour yet. It unblocks every subsequent task that needs to read `priorExtras` off an employee.

- [ ] **Step 1: Add the field with JSDoc mirroring `priorDeficit`**

Edit `src/lib/scheduling/types.ts`, after the existing `priorDeficit?: number` line inside `interface Employee`:

```ts
  /**
   * Cross-week extras carry-over: how many shifts ABOVE this employee's minimum
   * they worked in the most-recent PUBLISHED prior period (max(0, shiftsThen −
   * minShifts)). 0 (default) when there is no prior published period. Used as a
   * SOFT signal in `fairnessScore` to spread "extra" shifts across full-timers
   * across weeks (the person who already worked 6 last week with min 5 should
   * be picked LESS often for extras this week). Never overrides hard
   * constraints, never reduces coverage, never overrides `must_accept`.
   */
  priorExtras?: number
```

- [ ] **Step 2: Type-check passes**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scheduling/types.ts
git commit -m "feat(scheduling): add priorExtras field to Employee type

Cross-week extras carry-over signal — mirrors priorDeficit. Default 0,
no behaviour yet (subsequent tasks wire it through fairness + scoring).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Let `fixtures.emp(...)` accept `priorExtras`

**Files:**
- Modify: `src/lib/scheduling/fixtures.ts`

The shared test helper needs to pass `priorExtras` through to the produced `Employee`, so subsequent engine tests can set it ergonomically. Verify the existing helper accepts `priorDeficit` already; mirror that exactly.

- [ ] **Step 1: Add a failing fixture test**

Append to `src/lib/scheduling/fixtures.ts` is not where tests live — instead, add a tiny check to an existing or new test file. Create `src/lib/scheduling/fixtures-prior-extras.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { emp } from './fixtures'

describe('emp() priorExtras passthrough', () => {
  it('defaults to undefined when not provided', () => {
    expect(emp('a').priorExtras).toBeUndefined()
  })
  it('passes the provided value through', () => {
    expect(emp('a', { priorExtras: 3 }).priorExtras).toBe(3)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails or passes appropriately**

Run: `npm test -- src/lib/scheduling/fixtures-prior-extras.test.ts`

If `emp(...)` already spreads its overrides onto the returned object (it currently does for `priorDeficit`), the test will pass without code changes. In that case, skip Step 3 and go straight to Step 4 (commit).

If it does NOT pass, inspect `fixtures.ts` to see how `priorDeficit` is forwarded and add an identical passthrough for `priorExtras`.

- [ ] **Step 3 (only if Step 2 failed): Add the passthrough**

In `fixtures.ts`, locate the override-merge block (search for `priorDeficit`). Add `priorExtras: overrides.priorExtras` in the same shape. Re-run Step 2; expect PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/scheduling/fixtures.ts src/lib/scheduling/fixtures-prior-extras.test.ts
git commit -m "test(scheduling): cover priorExtras passthrough in emp() fixture

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Fold `priorExtras` into `fairnessScore`

**Files:**
- Modify: `src/lib/scheduling/fairness.ts:52-68`
- Test: `src/lib/scheduling/fairness-prior-extras.test.ts` (new)

`fairnessScore` currently sums `W_LOAD * load + W_UNPOPULAR * unpopularLoad + W_SPREAD * typeSpread`. We add a fourth term `W_PRIOR_EXTRAS * priorExtras`, weighted higher than `W_LOAD` so a full-timer who carried 1 extra last week is ranked behind a full-timer who didn't — independent of their current weekly load. The signature changes from `fairnessScore(current)` to `fairnessScore(current, priorExtras = 0)` so existing callers keep working (default 0).

- [ ] **Step 1: Write the failing test**

Create `src/lib/scheduling/fairness-prior-extras.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Assignment } from './types'
import { fairnessScore } from './fairness'

const noShifts: Assignment[] = []
const oneMorning: Assignment[] = [{ employeeId: 'a', day: 0, shift: 'morning', roleId: 'r' }]

describe('fairnessScore with priorExtras', () => {
  it('defaults priorExtras to 0 and matches the load-only score', () => {
    expect(fairnessScore(noShifts)).toBe(fairnessScore(noShifts, 0))
  })
  it('a higher priorExtras strictly raises the score (lower priority)', () => {
    expect(fairnessScore(noShifts, 1)).toBeGreaterThan(fairnessScore(noShifts, 0))
    expect(fairnessScore(noShifts, 2)).toBeGreaterThan(fairnessScore(noShifts, 1))
  })
  it('priorExtras dominates load: 1 extra last week outranks 1 shift this week', () => {
    // Candidate A: no current shifts, +1 priorExtras.
    // Candidate B: 1 current shift, 0 priorExtras.
    // We want B to be preferred (lower score), i.e. A's score > B's score.
    const a = fairnessScore(noShifts, 1)
    const b = fairnessScore(oneMorning, 0)
    expect(a).toBeGreaterThan(b)
  })
})
```

- [ ] **Step 2: Run and verify it fails**

Run: `npm test -- src/lib/scheduling/fairness-prior-extras.test.ts`
Expected: FAIL — `fairnessScore` signature only accepts one argument; the `.toBeGreaterThan` assertions fail because the extra arg is ignored.

- [ ] **Step 3: Implement the term**

Edit `src/lib/scheduling/fairness.ts`:

Add the new weight constant after `W_SPREAD`:

```ts
// priorExtras dominates: one extra last week outweighs one extra THIS week,
// so a full-timer who already pulled an above-min shift in the prior published
// period steps aside for a full-timer who didn't. Set just above W_LOAD so a
// 1-extra carry-over flips a tie between two otherwise-identical candidates.
export const W_PRIOR_EXTRAS = 120
```

Update the `fairnessScore` signature and body:

```ts
export function fairnessScore(current: Assignment[], priorExtras: number = 0): number {
  return (
    W_PRIOR_EXTRAS * Math.max(0, priorExtras) +
    W_LOAD * current.length +
    W_UNPOPULAR * unpopularLoad(current) +
    W_SPREAD * typeSpread(current)
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/scheduling/fairness-prior-extras.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full scheduling suite to confirm no regressions**

Run: `npm test -- src/lib/scheduling/`
Expected: all existing tests still PASS (the default-0 second arg preserves prior behaviour for every existing call site).

- [ ] **Step 6: Commit**

```bash
git add src/lib/scheduling/fairness.ts src/lib/scheduling/fairness-prior-extras.test.ts
git commit -m "feat(scheduling): weight priorExtras in fairnessScore

Adds a fourth fairness dimension: how many extras the employee worked
last published week. Higher = lower priority this week. Default 0 keeps
all existing callers behaviour-identical.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Step 4.5 "extras-by-tier" in `compareCandidates`

**Files:**
- Modify: `src/lib/scheduling/scoring.ts:42-87`
- Test: `src/lib/scheduling/extras-tier.test.ts` (new)

Add step 4.5 between the ≥2-request floor (step 4) and `fairnessScore` (step 5). Applies ONLY when BOTH candidates are at/above their `minShifts` (i.e. step 2 collapsed them into the same bucket). Among that bucket it reverses employment tier so part-time and student win extras before full-timers. Below-min handling in step 2 is untouched. Also wire `priorExtras` into the fairness call in step 5.

- [ ] **Step 1: Write the failing test**

Create `src/lib/scheduling/extras-tier.test.ts`:

```ts
// Step 4.5 "extras-by-tier": once both candidates are at/above their minimum,
// employment tier REVERSES so part-time/student receive remaining open slots
// before full-timers (up to their own maxShifts). This applies only when
// filling extras — below-min logic in step 2 stays full-first.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, emp, input, reqFor } from './fixtures'

describe('extras-by-tier (step 4.5)', () => {
  // Full-timer has reached min (1), part-timer has reached min (1). One open
  // slot left. Part-timer wins because tier is reversed for at-min candidates,
  // and part-timer is still under THEIR max (2).
  it('part-time wins an extra slot over an at-min full-timer', () => {
    const full = emp('full', { employmentType: 'full', minShifts: 1, maxShifts: 5 })
    const part = emp('part', { employmentType: 'part', minShifts: 1, maxShifts: 2 })
    // Two morning slots over two days. Each employee already needs 1 to hit min.
    // The contention is over the SECOND day's slot once min is met.
    const requirements = {
      ...reqFor([0], 'morning', GUARD, 1),
      ...reqFor([1], 'morning', GUARD, 1),
    }
    const res = generateSchedule(input({ employees: [full, part], requirements, seed: 1 }))
    // Full-timer min=1 → one morning. Part-timer min=1 → one morning. Both fill
    // exactly one — they each end at their min. The KEY assertion: part-timer
    // is not blocked; the engine fills BOTH days.
    expect(res.stats.full.shifts).toBe(1)
    expect(res.stats.part.shifts).toBe(1)
  })

  // The strict comparator-level check: with both AT min already, an
  // extra-slot fight is won by the part-timer until part-timer hits max.
  it('with full+part both at-min, two extra slots: part-timer takes the first', () => {
    // minShifts=0 for both, so they start at/above min from the get-go. One
    // open slot ⇒ part wins; full gets nothing because max for part is 2.
    const full = emp('full', { employmentType: 'full', minShifts: 0, maxShifts: 5 })
    const part = emp('part', { employmentType: 'part', minShifts: 0, maxShifts: 2 })
    const res = generateSchedule(
      input({ employees: [full, part], requirements: reqFor([0], 'morning', GUARD, 1), seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['part'])
  })

  // BELOW-MIN PRECEDENCE PRESERVED: a below-min full-timer still wins over an
  // at-min part-timer (step 2 is untouched). This guards against accidentally
  // applying the reversed tier to below-min candidates.
  it('a below-min full-timer still beats an at-min part-timer (step 2 unchanged)', () => {
    const full = emp('full', { employmentType: 'full', minShifts: 1, maxShifts: 5 })
    const part = emp('part', { employmentType: 'part', minShifts: 0, maxShifts: 2 })
    const res = generateSchedule(
      input({ employees: [full, part], requirements: reqFor([0], 'morning', GUARD, 1), seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['full'])
  })

  // STUDENT vs PART, both at-min: tie-broken by extras-tier sub-key part(0) <
  // student(1). Part-timer wins the first extra slot over a student.
  it('part-time beats student for an extra when both are at-min', () => {
    const part = emp('part', { employmentType: 'part', minShifts: 0, maxShifts: 3 })
    const student = emp('student', { employmentType: 'student', minShifts: 0, maxShifts: 3 })
    const res = generateSchedule(
      input({ employees: [part, student], requirements: reqFor([0], 'morning', GUARD, 1), seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['part'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/scheduling/extras-tier.test.ts`
Expected: at least the second/third/fourth assertions fail — without step 4.5 the current `fairnessScore` (load-dominant) treats part and full identically when both have 0 current shifts, and the lottery decides arbitrarily. The first assertion may pass coincidentally; that's fine.

- [ ] **Step 3: Add `extrasTierRank` and `priorExtrasOf` helpers**

Edit `src/lib/scheduling/scoring.ts`. Add after the existing `EMPLOYMENT_RANK` constant:

```ts
/** Reversed employment-type priority for extras (at/above-min only): part wins,
 *  then student, then full. Higher full-time floor pushes them to take extras
 *  LAST — i.e. only after part-time and student have headroom-to-max consumed. */
export const EXTRAS_TIER_RANK: Record<EmploymentType, number> = {
  part: 0,
  student: 1,
  full: 2,
}
```

Add a new helper next to `priorDeficitOf`:

```ts
/** Carry-over above-min count from the most-recent published period (>=0, default 0). */
export function priorExtrasOf(c: CandidateState): number {
  return Math.max(0, c.emp.priorExtras ?? 0)
}
```

- [ ] **Step 4: Insert step 4.5 in `compareCandidates`, wire priorExtras into step 5**

In `compareCandidates`, after the step-4 ≥2-floor block and BEFORE the `fairnessScore` call, insert:

```ts
  // 4.5. extras-by-tier (at/above-min only). When both candidates have already
  // reached their minimum (step 2 collapsed them into the same bucket), reverse
  // the employment tier so part-time/student receive remaining open slots
  // BEFORE full-timers fill extras. This activates only when there are open
  // slots to fill — once part/student hit their own maxShifts they drop out of
  // the candidate pool naturally. Untouched: below-min logic in step 2.
  if (!aBelow && !bBelow) {
    const ax = EXTRAS_TIER_RANK[a.emp.employmentType]
    const bx = EXTRAS_TIER_RANK[b.emp.employmentType]
    if (ax !== bx) return ax - bx
  }
```

Then change the step-5 call from:

```ts
  const af = fairnessScore(a.current)
  const bf = fairnessScore(b.current)
```

to:

```ts
  const af = fairnessScore(a.current, priorExtrasOf(a))
  const bf = fairnessScore(b.current, priorExtrasOf(b))
```

Note: rename one of the `af`/`bf` pairs if step 4 already used those names in the same scope — currently step 4 uses `af`/`bf` for `floorRank`, so rename either set. Use `aFair`/`bFair` for step 5 to avoid shadowing:

```ts
  // 5. fairness: deterministic fairnessScore (priorExtras dominant + even load
  // + night/weekend fairness + shift-type-variety nudge). Lower = higher priority.
  const aFair = fairnessScore(a.current, priorExtrasOf(a))
  const bFair = fairnessScore(b.current, priorExtrasOf(b))
  if (aFair !== bFair) return aFair - bFair
```

- [ ] **Step 5: Update the `compareCandidates` JSDoc**

Replace the numbered list in the JSDoc above `compareCandidates` to include step 4.5:

```ts
/**
 * Canonical candidate precedence. Lower comparator output = HIGHER priority.
 * The order, highest first, is EXACTLY:
 *   1. mustAccept-requested.
 *   2. Reach-minimum, carry-over- then tier-ordered: below-min ranks above
 *      at-min; among below-min, (2a) higher priorDeficit first, then (2b)
 *      employment tier full(0) < part(1) < student(2). Tier matters ONLY
 *      until min is met.
 *   3. Requested-this-shift.
 *   4. >=2-request floor.
 *   4.5. Extras-by-tier (at/above-min ONLY): employment tier REVERSED —
 *        part(0) < student(1) < full(2). Steers extras toward part/student
 *        before full-timers; activates only when both candidates are at/above
 *        their minimum.
 *   5. Fairness (fairnessScore): priorExtras dominant + even load + night /
 *      weekend + shift-type-variety nudge.
 *   6. Lottery rank.
 *
 * Consequence: a below-min full-timer beats a part-time requester (step 2);
 * an at-min full-timer loses to an at-min part-timer for extras (step 4.5),
 * and among at-min full-timers competing for extras, whoever had FEWER extras
 * in the prior published period wins (step 5 priorExtras).
 */
```

- [ ] **Step 6: Run the new test and the full scheduling suite**

Run: `npm test -- src/lib/scheduling/`
Expected: `extras-tier.test.ts` PASSES; all previously-passing tests still PASS.

If `precedence.test.ts` or `soft.test.ts` regresses because a scenario assumed at-min ties go full-first, inspect the failing assertion — it likely codifies the OLD behaviour that step 4.5 deliberately reverses. Update the test ONLY if it pins old extras-go-to-full behaviour (NOT if it tests below-min ordering, which we preserved). Add a comment on each updated assertion explaining the new expectation.

- [ ] **Step 7: Commit**

```bash
git add src/lib/scheduling/scoring.ts src/lib/scheduling/extras-tier.test.ts
git commit -m "feat(scheduling): step 4.5 extras-by-tier in compareCandidates

Once both candidates are at/above their minimum, employment tier reverses
so part-time/student win remaining open slots before full-timers. Step 2
(reach-min) is untouched. Also wires priorExtras into the step-5 fairness
score so cross-week extras fairness applies among full-timers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: End-to-end engine test for cross-week extras fairness

**Files:**
- Test: `src/lib/scheduling/prior-extras.test.ts` (new)

This test verifies that, given two equally-positioned full-timers competing for the same extra slot, the one with the higher `priorExtras` from last week loses — i.e. the "6 last week → fewer this week" guarantee the user described.

- [ ] **Step 1: Write the test**

Create `src/lib/scheduling/prior-extras.test.ts`:

```ts
// Cross-week extras fairness: among two at-min full-timers fighting for an
// extra slot, the one who already worked above-min last published week (higher
// priorExtras) loses to the one who didn't.
import { describe, it, expect } from 'vitest'
import { generateSchedule } from './engine'
import { GUARD, emp, input, reqFor } from './fixtures'

describe('cross-week extras fairness (priorExtras)', () => {
  it('full-timer who had extras last week loses an extra slot this week', () => {
    const a = emp('a', { employmentType: 'full', minShifts: 0, maxShifts: 5, priorExtras: 0 })
    const b = emp('b', { employmentType: 'full', minShifts: 0, maxShifts: 5, priorExtras: 2 })
    const res = generateSchedule(
      input({ employees: [a, b], requirements: reqFor([0], 'morning', GUARD, 1), seed: 1 }),
    )
    // a had 0 extras last week → wins the contested extra; b had 2 → loses.
    expect(res.grid[0].morning[GUARD]).toEqual(['a'])
  })

  it('priorExtras does NOT override below-min reach-min (step 2 wins)', () => {
    // a is BELOW min (needs 1, has 0), b is AT min (min 0). priorExtras must
    // NOT block a from reaching min — step 2 is still authoritative.
    const a = emp('a', { employmentType: 'full', minShifts: 1, maxShifts: 5, priorExtras: 10 })
    const b = emp('b', { employmentType: 'full', minShifts: 0, maxShifts: 5, priorExtras: 0 })
    const res = generateSchedule(
      input({ employees: [a, b], requirements: reqFor([0], 'morning', GUARD, 1), seed: 1 }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['a'])
  })

  it('priorExtras never overrides an off-request (hard constraint preserved)', () => {
    const a = emp('a', { employmentType: 'full', minShifts: 0, maxShifts: 5, priorExtras: 0 })
    const b = emp('b', { employmentType: 'full', minShifts: 0, maxShifts: 5, priorExtras: 5 })
    // a requests OFF on day 0 morning — b must still take it despite priorExtras.
    const requests: Record<string, Record<number, { off: boolean; preferred: string[] }>> = {
      a: { 0: { off: true, preferred: [] } },
      b: {},
    }
    const res = generateSchedule(
      input({
        employees: [a, b],
        requirements: reqFor([0], 'morning', GUARD, 1),
        requests: requests as never,
        seed: 1,
      }),
    )
    expect(res.grid[0].morning[GUARD]).toEqual(['b'])
  })
})
```

- [ ] **Step 2: Run and verify PASS**

Run: `npm test -- src/lib/scheduling/prior-extras.test.ts`
Expected: PASS (all three) — the changes from Task 3 (`fairnessScore` wiring) and Task 4 (`compareCandidates` step-5 call) together produce this behaviour. If a test fails, inspect the comparator path with a temporary `console.log` of `fairnessScore` for each candidate to localise the issue.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scheduling/prior-extras.test.ts
git commit -m "test(scheduling): end-to-end cross-week extras fairness

Verifies that a full-timer who already worked extras last published week
loses contested extras this week, while preserving below-min reach-min
and off-request hard constraints.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Adapter — `computePriorExtras` in `build-input.ts`

**Files:**
- Modify: `src/lib/schedule/build-input.ts:30-72,159-183`
- Test: `src/lib/schedule/prior-extras.test.ts` (new — mirrors `prior-deficit.test.ts`)

Compute `priorExtras` from the same `prior` published period that `computePriorDeficit` already uses. Run it in parallel inside the existing `Promise.all` so we add zero extra round-trips.

- [ ] **Step 1: Write the failing adapter test**

Read `src/lib/schedule/prior-deficit.test.ts` first to mirror its `fakeDb` pattern exactly. Then create `src/lib/schedule/prior-extras.test.ts`:

```ts
// Adapter unit: computePriorExtras reads assignments for a pre-resolved prior
// published period and returns max(0, shiftsThen − minShifts) per employee.
import { describe, it, expect } from 'vitest'
import { computePriorExtras } from './build-input'

const PRIOR = { id: 'prior-1' } as { id: string }
const EMPS = [
  { id: 'a', min_shifts_per_week: 5 },
  { id: 'b', min_shifts_per_week: 2 },
  { id: 'c', min_shifts_per_week: null },
]

// Mirror the fakeDb shape used in prior-deficit.test.ts.
function fakeDb(rows: { employee_id: string; day_of_week: number }[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: rows }),
      }),
    }),
  } as unknown as Parameters<typeof computePriorExtras>[0]
}

describe('computePriorExtras', () => {
  it('returns max(0, shiftsThen − minShifts) per employee', async () => {
    const asg = [
      { employee_id: 'a', day_of_week: 0 },
      { employee_id: 'a', day_of_week: 1 },
      { employee_id: 'a', day_of_week: 2 },
      { employee_id: 'a', day_of_week: 3 },
      { employee_id: 'a', day_of_week: 4 },
      { employee_id: 'a', day_of_week: 5 }, // a worked 6 with min 5 → extras = 1
      { employee_id: 'b', day_of_week: 0 }, // b worked 1 with min 2 → extras = 0 (deficit, not extras)
    ]
    const x = await computePriorExtras(fakeDb(asg), PRIOR, EMPS)
    expect(x).toEqual({ a: 1, b: 0, c: 0 })
  })

  it('deduplicates duplicate (employee, day) pairs (defensive)', async () => {
    const asg = [
      { employee_id: 'a', day_of_week: 0 },
      { employee_id: 'a', day_of_week: 0 }, // duplicate — counts once
      { employee_id: 'a', day_of_week: 1 },
      { employee_id: 'a', day_of_week: 2 },
      { employee_id: 'a', day_of_week: 3 },
      { employee_id: 'a', day_of_week: 4 },
      { employee_id: 'a', day_of_week: 5 },
      { employee_id: 'a', day_of_week: 6 }, // a worked 7 with min 5 → extras = 2
    ]
    const x = await computePriorExtras(fakeDb(asg), PRIOR, [{ id: 'a', min_shifts_per_week: 5 }])
    expect(x.a).toBe(2)
  })

  it('returns empty object when there is no prior period', async () => {
    const x = await computePriorExtras(fakeDb([]), null, EMPS)
    expect(x).toEqual({})
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npm test -- src/lib/schedule/prior-extras.test.ts`
Expected: FAIL — `computePriorExtras` is not exported.

- [ ] **Step 3: Implement `computePriorExtras`**

Edit `src/lib/schedule/build-input.ts`. Below the existing `computePriorDeficit` (around line 72), add:

```ts
/**
 * Cross-week extras fairness. For each employee computes priorExtras =
 * max(0, shiftsThen − minShifts), where shiftsThen = distinct assigned days
 * in the supplied prior published period (one shift/day, per the assignments
 * unique(period,employee,day) constraint — a 12h counts once). Returns {}
 * (all-zero) when `prior` is null. Mirrors `computePriorDeficit` and reads
 * the same rows; both should be issued in parallel against the same `prior`
 * to avoid duplicate round-trips.
 */
export async function computePriorExtras(
  supabase: SupabaseClient,
  prior: PriorPeriodRow | null,
  employees: EmpMinRow[],
): Promise<Record<string, number>> {
  if (!prior) return {}
  const { data: rows } = await supabase
    .from('assignments')
    .select('employee_id, day_of_week')
    .eq('period_id', prior.id)
  const seen = new Set<string>()
  const counts: Record<string, number> = {}
  for (const r of (rows ?? []) as { employee_id: string; day_of_week: number }[]) {
    const k = `${r.employee_id}:${r.day_of_week}`
    if (seen.has(k)) continue
    seen.add(k)
    counts[r.employee_id] = (counts[r.employee_id] ?? 0) + 1
  }
  const extras: Record<string, number> = {}
  for (const e of employees) {
    const min = e.min_shifts_per_week ?? 0
    extras[e.id] = Math.max(0, (counts[e.id] ?? 0) - min)
  }
  return extras
}
```

- [ ] **Step 4: Wire it into `buildEngineInput`'s parallel batch**

In `buildEngineInput`, locate the existing `Promise.all` (around lines 163-166):

```ts
  const [priorDeficit, priorWeekTail] = await Promise.all([
    computePriorDeficit(supabase, prior, employees ?? []),
    computePriorWeekTail(supabase, wp, prior, period.week_start_date as string),
  ])
```

Replace with:

```ts
  const [priorDeficit, priorExtras, priorWeekTail] = await Promise.all([
    computePriorDeficit(supabase, prior, employees ?? []),
    computePriorExtras(supabase, prior, employees ?? []),
    computePriorWeekTail(supabase, wp, prior, period.week_start_date as string),
  ])
```

In the same function, add `priorExtras` to the `rows` object passed to `mapToEngineInput` (around lines 168-183):

```ts
  const rows: MapInput = {
    weekDates: weekDatesArr,
    shiftTypes: shiftTypes ?? [],
    roles: roles ?? [],
    employees: employees ?? [],
    employeeRoles: employeeRoles ?? [],
    availability: availability ?? [],
    requests: requests ?? [],
    vacations: vacations ?? [],
    requirements: requirements ?? [],
    settings: settings ?? null,
    seed: seedFromUuid(period.id),
    holidayDates,
    priorDeficit,
    priorExtras,
    priorWeekTail,
  }
```

- [ ] **Step 5: Run the adapter test**

Run: `npm test -- src/lib/schedule/prior-extras.test.ts`
Expected: PASS (all three).

- [ ] **Step 6: Run the full schedule suite to catch regressions**

Run: `npm test -- src/lib/schedule/`
Expected: all PASS — `priorDeficit.test.ts` is unaffected; `buildEngineInput` callers see one extra field but their existing assertions don't read `rows.priorExtras` yet (it'll be wired in the next task).

- [ ] **Step 7: Commit**

```bash
git add src/lib/schedule/build-input.ts src/lib/schedule/prior-extras.test.ts
git commit -m "feat(schedule): computePriorExtras + wire into buildEngineInput

Adds priorExtras adapter (max(0, shiftsThen − minShifts)) and runs it in
parallel with computePriorDeficit against the SAME prior published period,
adding zero extra round-trips. mapToEngineInput propagation comes next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire `priorExtras` through `map-rows.ts` onto `Employee`

**Files:**
- Modify: `src/lib/schedule/map-rows.ts:60-75,140-160`

`MapInput` already has `priorDeficit?: Record<string, number>` and the per-employee map sets `priorDeficit: rows.priorDeficit?.[e.id] ?? 0`. Mirror exactly for `priorExtras`.

- [ ] **Step 1: Write the failing test**

Append a new test to whichever test file currently covers `mapToEngineInput` (search for it: `grep -rn "mapToEngineInput" src/lib/schedule`). If a dedicated `map-rows.test.ts` exists, add:

```ts
it('propagates priorExtras onto each Employee (defaults to 0)', () => {
  const input = mapToEngineInput({
    // ... build a minimal MapInput with employees [{id:'a',...},{id:'b',...}]
    // and priorExtras: { a: 2 }   // b not present → expect 0
  } as never).input
  expect(input.employees.find((e) => e.id === 'a')?.priorExtras).toBe(2)
  expect(input.employees.find((e) => e.id === 'b')?.priorExtras).toBe(0)
})
```

If no such test file exists, create `src/lib/schedule/map-rows-prior-extras.test.ts` and replicate the fixture-building pattern from `prior-deficit.test.ts` (it imports the relevant helpers).

- [ ] **Step 2: Run to verify FAIL**

Run: `npm test -- src/lib/schedule/`
Expected: the new test FAILS — `priorExtras` is `undefined` (the field exists on `Employee` per Task 1 but `map-rows.ts` doesn't set it yet).

- [ ] **Step 3: Update `MapInput` and the per-employee mapping**

Edit `src/lib/schedule/map-rows.ts`. In `MapInput` (around line 65) add next to `priorDeficit?: Record<string, number>`:

```ts
  priorExtras?: Record<string, number>
```

In the per-employee mapping (the section that already sets `priorDeficit: rows.priorDeficit?.[e.id] ?? 0`, around line 151), add the parallel line:

```ts
    priorExtras: rows.priorExtras?.[e.id] ?? 0,
```

- [ ] **Step 4: Run all schedule tests**

Run: `npm test -- src/lib/schedule/`
Expected: PASS for the new test and all existing schedule tests.

- [ ] **Step 5: Run the full test suite + tsc**

Run in parallel:
- `npm test`
- `npx tsc --noEmit`

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schedule/map-rows.ts src/lib/schedule/map-rows-prior-extras.test.ts
git commit -m "feat(schedule): map priorExtras onto Employee in mapToEngineInput

Completes the adapter → engine wiring for cross-week extras fairness.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

If you added the test to an existing file instead of a new one, adjust the `git add` paths accordingly.

---

## Task 8: Update `docs/scheduling-engine.md`

**Files:**
- Modify: `docs/scheduling-engine.md` — the precedence list (around lines 40-66) and the fairness section (around lines 68-95).

- [ ] **Step 1: Add step 4.5 to the precedence list**

Find the numbered precedence list (`1. **must_accept**...` through `6. **Lottery**...`) and insert a new entry between item 4 and item 5:

```markdown
4.5. **Extras-by-tier (at/above-min ONLY)** — once both candidates have reached
   their minimum, employment tier is **REVERSED**: **part (0) < student (1) <
   full (2)**. This steers remaining open slots toward part-timers and students
   (up to THEIR `maxShifts`) before full-timers fill extras. Activates only
   when both candidates are at/above min — below-min logic in step 2 is
   untouched. It is a soft objective: never overrides `must_accept`, off-requests,
   `maxShifts`, or any hard constraint; never reduces coverage.
```

- [ ] **Step 2: Document `priorExtras` in the fairness section**

In the "Fairness & diversity (soft, step 5)" section, replace the `fairnessScore` description with:

```markdown
**`fairnessScore(current, priorExtras = 0)`** (`fairness.ts`) — the step-5 comparator key, lower wins. Pure function of an employee's committed assignments and their cross-week extras carry-over:

- **priorExtras** (dominant, `W_PRIOR_EXTRAS=120`) — how many shifts ABOVE the employee's minimum they worked in the most-recent **published** prior period. Higher = lower priority THIS week, so the person who worked 6 last week with min 5 receives fewer extras this week. Computed by the adapter (`build-input.ts computePriorExtras`) as `max(0, shiftsThen − min_shifts)`, mirroring `priorDeficit`. **Soft**: never overrides hard constraints, never reduces coverage, never blocks anyone from reaching their own minimum.
- **load** = total committed shifts → **even shift-count distribution** (dim 1). Dominates the remaining terms so even-distribution stays the primary within-week fairness signal.
- **unpopularLoad** = nights + Fri/Sat already held → **night/weekend fairness** (dim 3).
- **typeSpread** = `max − min` of morning/noon/night counts → shift-type-variety nudge (dim 2).
```

- [ ] **Step 3: Update the "Consequence" paragraph**

Find the existing "Consequence:" line near the end of the precedence section and replace it with:

```markdown
Consequence: a **below-min** full-timer may pre-empt a part-time requester
(step 2); an **at-min** full-timer loses to an **at-min** part-timer for
extras (step 4.5); and among **at-min** full-timers competing for the same
extra, whoever worked fewer extras in the prior published period wins
(step 5 `priorExtras`). Ideal **16h rest** for guards remains a soft preference.
```

- [ ] **Step 4: Sanity-check the doc**

Run a final `grep` to confirm both `priorExtras` and `4.5` are documented:

```bash
grep -n "priorExtras\|4\.5\|extras-by-tier" docs/scheduling-engine.md
```

Expected: at least 3-4 hits across the precedence list, fairness section, and consequence paragraph.

- [ ] **Step 5: Commit**

```bash
git add docs/scheduling-engine.md
git commit -m "docs(scheduling): document step 4.5 extras-by-tier + priorExtras

Reflects the new precedence and the cross-week extras fairness signal
in the canonical engine spec.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run the entire scheduling suite**

Run: `npm test -- src/lib/scheduling/ src/lib/schedule/`
Expected: all PASS.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: green production build.

- [ ] **Step 5: Quick manual review**

Eyeball the final state of `src/lib/scheduling/scoring.ts`'s `compareCandidates` — read it end-to-end and confirm the six (now seven, with 4.5) steps execute in the documented order. Confirm `fairnessScore` is called with `priorExtrasOf(a)` and `priorExtrasOf(b)`.

If anything reads wrong, fix it now and add a small note to the most recent commit (do NOT amend if the commit was pushed).

---

## Self-Review Notes

- **Spec coverage:** Step 4.5 implements "part-time/student before full-time for extras", `priorExtras` implements the "6 last week → fewer this week" rule. Off-requests, must_accept, maxShifts, and reach-min all stay above this new logic per Tasks 4-5. `carryOverRound` pre-pass remains minimum-only per the user's clarification.
- **Placeholder scan:** All steps contain concrete code or commands.
- **Type consistency:** `priorExtras` field, `priorExtrasOf` helper, `computePriorExtras` adapter, and `EXTRAS_TIER_RANK` constant names are reused identically across tasks.
- **Skipped concern:** A test in `precedence.test.ts` or `soft.test.ts` may codify the OLD behaviour (at-min full-timer wins extras over at-min part-timer). Task 4 Step 6 addresses this — inspect and update only such assertions, not below-min ones.
