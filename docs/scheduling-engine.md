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
5. **Fairness** — fewer total assigned shifts.
6. **Lottery** — deterministic per-employee rank (seeded for reproducibility & testing) as the final
   tie-break. Losers of a contended slot go unfilled.

Consequence: a **below-min** full-timer may pre-empt a part-time requester (step 2), but an **at-min**
full-timer loses to a part-time requester (step 3 decides). Ideal **16h rest** for guards remains a soft
preference (not a hard cap).

## 12h fallback policy
Base shifts are 8h (morning/noon/night). When the 8h grid cannot be fully staffed within the hard
constraints AND `allow_12h_fallback`, propose 12h variants (07–19 / 19–07 / 03–15 / 15–03) only where
needed, flagged for manager approval. A 12h assignment occupies two adjacent 8h windows and updates
rest/coverage accordingly.

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
