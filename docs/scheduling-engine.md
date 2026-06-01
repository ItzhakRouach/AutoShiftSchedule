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
2. **Reach-minimum, tier-ordered.** An employee **below** their `min_shifts` ranks above one who has
   **reached** it. Among below-min employees only, employment tier breaks the tie: **full (0) < part (1) <
   student (2)** — full-time first. **This is the ONLY place employment tier matters, and only until min is
   reached.** Once an employee is at/above min, tier grants no priority.
3. **Requested-this-shift** — a requester ranks above a non-requester.
4. **≥2-request floor** — fewer satisfied requests so far ranks higher, driving the guarantee of **≥2**
   requests per employee when possible (else **≥1**). (Per-employee request-satisfaction floor.)
5. **Fairness & diversity** — a deterministic `fairnessScore` (see below) replaces the old raw
   shift-count tie-break. Lower = higher priority.
6. **Lottery** — deterministic per-employee rank (seeded for reproducibility & testing) as the final
   tie-break. Losers of a contended slot go unfilled.

Consequence: a **below-min** full-timer may pre-empt a part-time requester (step 2), but an **at-min**
full-timer loses to a part-time requester (step 3 decides). Ideal **16h rest** for guards remains a soft
preference (not a hard cap).

### Fairness & diversity (soft, step 5) — coverage-preserving
All four dimensions are SOFT: they rank **below** the hard constraints and the higher soft objectives
(steps 1–4) and **above** the lottery (step 6). **Coverage never regresses** — these are tie-breaks and
swaps only; the engine still maximises filled slots exactly as before, and determinism is preserved (same
seed + input → identical output; all fairness signals are computed, not random).

**`fairnessScore(current)`** (`fairness.ts`) — the step-5 comparator key, lower wins. Pure function of an
employee's committed assignments:
`100·load + 8·unpopularLoad + 3·typeSpread`, where
- **load** = total committed shifts → **even shift-count distribution** (dim 1). Dominant weight, so even
  load is always the primary signal and is never overturned by the lower terms within a realistic week
  (each employee's min/max still bounds load — no global cap is added).
- **unpopularLoad** = count of the employee's shifts that are a **night** OR fall on **Fri (day 5) / Sat
  (day 6)** → **night/weekend fairness** (dim 3): spreads the unpopular shifts.
- **typeSpread** = `max − min` of the employee's morning/noon/night counts → a nudge toward **shift-type
  variety** (dim 2).

**Diversity post-pass** (`diversity.ts`, run after the 8h general fill and before the 12h pass) finishes the
two SLOT-SPECIFIC dimensions a per-day employee ordering cannot fully control:
- **dim 2 — shift-type variety**: don't strand someone on a single type.
- **dim 4 — co-worker rotation**: vary who works alongside whom. **"Worked together" = assigned to the same
  `day` AND same `shift`** (the same physical shift block); the repetition penalty is `Σ max(0, shared − 1)`
  over employee pairs.

It minimises a global objective `diversityCost = Σ typeSpread(emp) + co-worker-repetition`. Each pass it
scans all committed-8h assignment pairs of two **different** employees in deterministic (input) order and
applies the single **best strictly-improving legal swap** of their occupants — keeping every required slot
filled (a swap only changes WHO fills a slot, never how many are filled) and re-checking all 8 hard
constraints for both employees. A strict-decrease rule plus a fixed pass cap (24) guarantee termination and
reproducibility. Because swaps never change any employee's total shift count, steps 1–4 (reach-min,
requested, the ≥2-request floor) and the even-load signal are all preserved.

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
