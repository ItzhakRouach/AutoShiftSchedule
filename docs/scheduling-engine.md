# Scheduling Engine (Phase 4 spec)

Pure TypeScript in `src/lib/scheduling/` (no I/O → fully unit-testable). Seeded from
`DesignTemplate/data.jsx` (`generateSchedule`) and extended to the full ruleset below. Build with **TDD**
and an exhaustive test matrix — the calculation must be flawless across every case.

## Inputs
- Employees, each with: roles (multi), `employment_type` (full | part | student), `min_shifts_per_week`,
  `max_shifts_per_week`, `observes_shabbat`, `observes_holidays`, `must_accept`, and a **recurring
  availability profile** (per day-of-week → which shifts they can work — see below).
- Weekly `requests` (per day: off / preferred shift ids) + `employee_vacations` (date ranges).
- `shift_requirements` (per day-of-week × shift × role → count), `shift_types` (8h base + 12h fallback),
  `holidays`, settings (`min_rest_hours`=8, `ideal_rest_hours`=16, `allow_12h_fallback`).

## Employment type → shift counts
- **full-time:** min 5 shifts/week (default). **part-time:** flexible min/max. **student:** max 3.
- `employment_type` sets sensible default min/max, but explicit `min_shifts_per_week`/`max_shifts_per_week`
  override. Engine never assigns more than max, and tries to reach min.

## Recurring availability profile (NEW — hard constraint)
Some guards can only work certain shifts on certain day-types. Example: weekdays → nights only;
Fri/Sat → night, noon, or morning. Model per-employee availability as (employee × day_of_week × shift)
"allowed" flags. If a profile exists for an employee, they are assignable on a given day ONLY to shifts
marked allowed for that day_of_week. (No profile ⇒ available to all, subject to the other rules.)
Data model addition (Phase 4 migration): `employee_availability(employee_id, day_of_week, shift_key/shift_type_id, allowed)` plus `employees.employment_type` + `employees.max_shifts_per_week`.

## Hard constraints (must always hold)
1. Role match — employee holds the required role.
2. Off request / vacation range / not-available-this-day → not assignable.
3. **Recurring availability** — only shifts allowed by the employee's profile for that day-of-week.
4. **Shabbat** (observer): blocked Fri צהריים+לילה and Sat בוקר+צהריים; Sat לילה (23:00) allowed.
5. **Holiday** (observer): same pattern around each `holidays` date (+ all holiday days).
6. Minimum rest between shifts = `min_rest_hours` (default 8). Absolute-hour math (`day*24 + start`, `+hours`).
7. One shift per employee per day.
8. Never exceed `max_shifts_per_week`.

## Soft objectives (canonical priority order — highest first)
This is the EXACT order implemented in `scoring.ts compareCandidates` (and threaded into the
reservation pre-pass via `dayfill.ts isTopPrecedenceFor`). Lower comparator output = higher priority.

1. **`must_accept` requested** — a must-accept employee's requested shift wins outright (their off-day
   request is already a hard constraint).
2. **Reach-minimum, carry-over- / tightness- / tier-ordered.** An employee **below** their `min_shifts`
   ranks above one who has **reached** it. Among below-min employees only, THREE sub-keys break the tie, in order:
   **(2a) cross-week `priorDeficit`** — whoever was MORE short of their minimum in the most-recent
   **published** prior week ranks first (carry-over fairness, so the same people aren't repeatedly
   short-changed); then **(2b) tight-availability first** — an employee whose legal-slot set is
   **restricted** (explicit `availability` map OR `observes_shabbat` OR `observes_holidays`) ranks ahead
   of an unrestricted employee. This is the load-bearing fix for the "part-timer gets squeezed below min
   while a full-timer collects extras" pathology: when a Shabbat-observing part-timer and an unrestricted
   full-timer both need a weekday slot they can BOTH take, the part-timer wins because the unrestricted
   full-timer still has weekend slots to reach min, while the part-timer doesn't. Then **(2c) employment
   tier** — **full (0) < part (1) < student (2)** — among equally-tight equally-deficit below-min
   candidates. **Tier matters ONLY until min is reached.** Once an employee is at/above min, none of these
   sub-keys separate them. `priorDeficit = max(0, min_shifts − shiftsAssignedInPriorPublishedPeriod)`,
   computed by the adapter (`build-input.ts computePriorDeficit`) and `0` when there is no prior published
   period. The whole step is a **soft** objective: below all hard constraints (off-requests stay hard, so
   "reach their minimum unless they requested off" is automatic), it never reduces coverage and never
   overrides `must_accept`. A coverage-preserving reservation pre-pass (`fill.ts carryOverRound`) reserves
   open slots toward min for carry-over employees BEFORE general fill, but only via legal, top-precedence
   assignments — so total filled slots are identical with or without it; it only decides WHO fills a slot.
3. **Requested-this-shift** — a requester ranks above a non-requester.
4. **≥2-request floor** — fewer satisfied requests so far ranks higher, driving the guarantee of **≥2**
   requests per employee when possible (else **≥1**). (Per-employee request-satisfaction floor.)
5. **Fairness & diversity** — a deterministic `fairnessScore` (see below) decides extras across ALL
   employees with no tier preference. Lower = higher priority. Cross-week extras fairness lives here via
   `priorExtras` (dominant term): whoever worked above their minimum last published week receives fewer
   extras this week.
6. **Lottery** — deterministic per-employee rank (seeded for reproducibility & testing) as the final
   tie-break. Losers of a contended slot go unfilled.

Consequence: a **below-min** full-timer may pre-empt a part-time requester (step 2 outer); but a
**below-min** Shabbat-observing or availability-restricted employee pre-empts an **below-min** unrestricted
full-timer (step 2b), ensuring restricted employees reach min before unrestricted ones collect extras.
Above min, extras distribute fairly across all employees via `fairnessScore` with the prior-week extras
carry-over (whoever worked 6 last week receives fewer this week). Ideal **16h rest** for guards remains a
soft preference.

### Fairness & diversity (soft, step 5) — coverage-preserving
All four dimensions are SOFT: they rank **below** the hard constraints and the higher soft objectives
(steps 1–4) and **above** the lottery (step 6). **Coverage never regresses** — these are tie-breaks and
swaps only; the engine still maximises filled slots exactly as before, and determinism is preserved (same
seed + input → identical output; all fairness signals are computed, not random).

**`fairnessScore(current, priorExtras = 0)`** (`fairness.ts`) — the step-5 comparator key, lower wins.
Pure function of an employee's committed assignments and their cross-week extras carry-over:

- **priorExtras** (dominant, `W_PRIOR_EXTRAS=120`) — how many shifts ABOVE the employee's minimum they
  worked in the most-recent **published** prior period. Higher = lower priority THIS week, so the person
  who worked 6 last week with min 5 receives fewer extras this week. Computed by the adapter
  (`build-input.ts computePriorExtras`) as `max(0, shiftsThen − min_shifts)`, mirroring `priorDeficit`.
  **Soft**: never overrides hard constraints, never reduces coverage, never blocks anyone from reaching
  their own minimum.
- **load** = total committed shifts → **even shift-count distribution** (dim 1). Dominates the remaining
  terms so even-distribution stays the primary within-week fairness signal.
- **unpopularLoad** = nights + Fri/Sat already held → **night/weekend fairness** (dim 3).
- **typeSpread** = `max − min` of morning/noon/night counts → shift-type-variety nudge (dim 2).

**Diversity post-pass** (`diversity.ts`, run after the 8h general fill and before the 12h pass) finishes the
two SLOT-SPECIFIC dimensions a per-day employee ordering cannot fully control:
- **dim 2 — shift-type variety**: don't strand someone on a single type.
- **dim 4 — co-worker rotation**: vary who works alongside whom. **"Worked together" = assigned to the same
  `day` AND same `shift`** (the same physical shift block); the repetition penalty is `Σ max(0, shared − 1)`
  over employee pairs.

It minimises a global objective
`diversityCost = 1000·(Σ typeSpread(emp) + co-worker-repetition) + nightWeekendSpread`
(the night/weekend spread is a low-weight guard so a diversity move never worsens dim 3). Each pass it
enumerates candidate **moves over the occupants of already-filled 8h cells** — **2-swaps** (exchange two
cells' occupants) and **3-cycle rotations** (rotate occupants among three cells) — and applies the single
**best strictly-improving** move. A move is applied ONLY when it:
- keeps every required slot filled (a move only changes WHO fills a cell, never how many) and re-checks **all
  8 hard constraints** for every mover against their assignments **excluding the vacated cell**;
- is **request-preserving** (`request-gate.ts`): it never lowers any involved employee's satisfied-request
  count and never pushes anyone below their request floor `min(2, requestCount)`. Requests rank above
  fairness, so the pass can never strip a granted request (this is a hard GATE, not just a cost term);
- strictly lowers `diversityCost`.

The pass is **reorder-invariant**: it iterates a **canonical order** (employee id, then day, shift, role) —
built in `moves.ts`/`diversity.ts` — so the result is identical regardless of `input.employees` array order.
A strict-decrease rule plus a fixed pass cap (24) guarantee termination and reproducibility; same seed +
data → identical grid. Because moves never change any employee's total shift count, steps 1–4 (reach-min,
requested, the ≥2-request floor) and the even-load signal are all preserved. After the pass, satisfied-request
counts are recomputed from the final committed state so `EmployeeStat.requestsSatisfied` stays accurate.
The 3-cycle rotations escape the single-type **stranding** local optimum that swap-only could not.
Modules: `diversity.ts` (cost + orchestration), `moves.ts` (swap/3-cycle primitives), `request-gate.ts`
(satisfied-count gate).

Per-shift-type counts are surfaced on `EmployeeStat.byType { morning, noon, night }` for transparency/tests.

## 12h auto-coverage policy (CONFIRMED product rules)
Base shifts are 8h (morning 07–15 / noon 15–23 / night 23–07). **Full coverage is mandatory.** After the
normal 8h matching pass, every still-uncovered required (shift, role) slot is auto-covered with 12h shifts
**up to the limit of what is physically possible** (when `allow_12h_fallback`). A gap remains (warning) only
when no eligible employee physically remains.

**12h model.** A 12h shift = one person working **two consecutive 8h windows**, filling the required role in
**each covered window**. **Cross-role is allowed**: the person may fill different roles in the two windows as
long as they hold the role required for each (e.g. an אחמ״ש who also holds מוקדן covers מוקדן at noon then
continues into night as אחמ״ש). To cover a role-position across the whole day, **two people work
complementary 12h shifts** (one relieves the other).

**Variant preference (STRICT).** Prefer 8h. When 12h is needed, prefer the **day/night split**:
`m12_day` (07–19) + `m12_night` (19–07). Use `m12_3to15` (03–15) / `m12_15to3` (15–03) **ONLY as an absolute
last resort**, when the day/night variants cannot close the gap (e.g. a single person must bridge a
morning+night gap, which only `m12_3to15` can do in one shift).

**Covers mapping.** Two distinct maps (`fallback.ts`):
- `TWELVE_HOUR_COVERS` — windows a variant *physically touches*; used for HARD checks (sacred/availability):
  `m12_day`→[morning,noon]; `m12_night`→[noon,night]; `m12_3to15`→[night,morning]; `m12_15to3`→[noon,night].
- `TWELVE_HOUR_FILLS` — base-shift requirements a variant *counts toward* (no double-count so the day/night
  pair cleanly tiles the day): `m12_day`→[morning,noon]; `m12_night`→[night]; `m12_3to15`→[night,morning];
  `m12_15to3`→[noon,night]. Thus {m12_day, m12_night} = full day, and {m12_3to15, m12_15to3} = full day.

**Hard constraints on a 12h** (`twelve-rules.ts canTwelve`): rest ≥ `min_rest_hours` using the 12h's real
duration vs every other committed shift; the 12h is the person's ONE shift that day (no other shift same day,
incl. absorbing their own same-day 8h); never exceed `max_shifts`; every covered/touched window must be
allowed by availability; Shabbat/holiday blocks the whole 12h for an observer if ANY touched window is sacred.

**Output.** A 12h assignment occupies each covered base-shift cell in the grid (each flagged `is12h: true`,
`variant`) AND yields a single canonical record `twelveHourAssignments[]` (employee, day, variant,
`rolesByShift`) for persistence. `twelveHourSuggestions` are derived from the **residual** warnings that even
12h auto-coverage could not close (manager hints).

**Algorithm.** The 12h pass (`twelve-fill.ts`) iterates days; per day it greedily assigns the preferred
day/night variants (ordered by the same candidate precedence as the 8h pass), absorbing an employee's own
same-day 8h into a 12h where that extends coverage, and performing **monotonic displacement** (free an 8h
holder so the day/night pair can tile the whole day, only when it yields a net coverage gain → guarantees
termination). Only after the pair is exhausted does it use the last-resort 03-15/15-03 variants.

## Feasibility (12h-aware)
`maxStaffable`/`coverage.filledSlots` reflect the **full 8h + 12h** fill. Status: `ok` when everything is
covered (incl. via 12h); `needs12h` when 8h-alone is short but the 12h pass closes more (only achievable WITH
12h); `short` when still short and 12h cannot help. A week fully coverable via 12h reports `ok`.

## Feasibility pre-check (NEW — feature)
Before/at scheduling time, compute and surface: **"are there enough available employees this week to cover
all required slots with regular 8h shifts, or are 12h shifts needed?"** Output a clear status per the week
(e.g. OK / short by N / 12h required for X slots), so the manager knows up front. Pure function over the
same inputs; drives a UI banner.

## Algorithm (sketch)
Two passes (requested-first, then any-eligible) over days×shifts×roles, honoring all hard constraints; apply
the soft objectives via candidate scoring + lottery tie-breaks; enforce the ≥2 (else ≥1) request floor and
full-time-first ordering; finally propose 12h fallbacks for residual gaps. Returns
`{ grid, assignments, warnings, coverage, stats, feasibility }`. Manual edits (Phase 5) re-validate via
`validateAssignment()`; applying a 12h shift blocks the overlapping adjacent slot and recomputes.

## Exhaustive test matrix (TDD — must all pass)
Cover at minimum: all-8h fully staffed; understaffed → 12h needed; **12h across the whole week**; **half-week
12h**; a few isolated single shifts; Shabbat/holiday observer boundaries (incl. Sat-night allowed, holiday
eve/exit); 8h-rest violations rejected; recurring-availability (weekday-nights-only guard, weekend-flex
guard); must_accept honored; vacation ranges excluded; lottery fairness with N>slots requesters
(deterministic seed → assert winners); ≥2-requests floor (and the ≥1 fallback when 2 impossible);
min/max per employment type; full-time-before-part-time ordering; max-shifts never exceeded; feasibility
pre-check correctness (OK vs short vs 12h-required). Build hand-computed fixtures and assert exact output.
