# Scheduling Engine

Pure TypeScript in `src/lib/scheduling/` (no I/O → fully unit-testable). Seeded from
`DesignTemplate/data.jsx` (`generateSchedule`) and extended. Built in Phase 4 (TDD).

## Inputs / outputs
Input: employees (roles, min shifts, observes_shabbat/holidays, must_accept), requests (per-day off /
preferred shifts / vacation ranges), shift_requirements, holidays, settings (min_rest_hours,
allow_12h_fallback). Output: `{ grid, assignments, warnings, coverage, stats }`.

## Hard constraints (must hold)
1. Role match — employee must hold the required role.
2. Day-off / vacation range / `off` request → not assignable.
3. **Shabbat** (observer): blocked Fri **צהריים+לילה** and Sat **בוקר+צהריים**; Sat **לילה (23:00) allowed**.
4. **Holiday** (observer): same pattern around each `holidays` date (ערב חג noon+night, יום החג morning+noon,
   plus all holiday days).
5. Minimum rest between shifts = `min_rest_hours` (default 8). Use absolute-hour math
   (`day*24 + start`, `+ hours`) as in `DesignTemplate/data.jsx`.
6. One shift per employee per day.

## Soft preferences (scored, sorted)
Requested shift (high weight) → `must_accept` priority (off-day is hard) → under `min_shifts` →
fairness (fewer shifts so far / hour balance) → 16h-rest ideal bonus for guards.

## Algorithm
Two passes: (1) fill only from employees who requested the slot; (2) relax to any eligible. Remaining gaps →
propose **12h fallback** variants (07–19 / 19–07 / 03–15 / 15–03) **only** if `allow_12h_fallback`, flagged for
manager approval. Manual edits (Phase 5) re-validate via `validateAssignment()`; applying a 12h shift blocks
the overlapping adjacent slot and recomputes coverage/rest.
