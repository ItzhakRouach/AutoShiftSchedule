# Design — Modular app: multi-workplace + configurable roles / shifts / working-days

**Date:** 2026-06-02 · **Status:** approved, implementing phase-by-phase

## Goal
Turn the security-specific scheduler into a product configurable for any job, **without breaking the proven scheduling engine** (369 unit + ~36 e2e green). Add: multiple work locations per org with a top-nav switcher; configurable roles (add/rename/recolor/delete + rank); configurable shifts (rename/retime/disable, up to 3 slots); configurable worker counts per shift/role; a working-days selector (e.g. Sun–Thu). Invited workers stay scoped to the org + their invite's workplace.

## Confirmed decisions
- **Shifts:** keep up to 3 internal slots (`morning/noon/night` keys stay as identifiers); make display name, times, color, active editable. No engine shift-model rewrite.
- **Working days:** per-workplace selector; non-work days are simply not scheduled (zero requirements).
- **Shabbat/holiday:** unchanged Israeli logic, opt-in per employee.
- **Workplace switching:** top-nav dropdown + "add workplace", remembered via cookie.

## Out of scope (protects the engine)
Arbitrary shift counts (2/4/5…), free shift identifiers, generalizing Shabbat to other days/cultures, non-Sunday week-start. These require rewriting the engine's shift model / 12h fallback / Shabbat rules.

## Engine-safety principle
Every engine/adapter change is additive with a default that reproduces today's behavior; the existing 369 unit tests + fixtures must pass unchanged. New behavior gets new TDD tests. QA-gate each phase.

## Phases
1. **Multi-workplace** (no engine risk): active workplace via cookie (`getActiveWorkplace`/`listWorkplaces`/`setActiveWorkplace`), reusable `createWorkplaceWithDefaults`, top-nav `WorkplaceSwitcher` (+ add workplace), invites scope to the active workplace (already do). DB/RLS already support many workplaces per org; one-org-per-user stays.
2. **Configurable roles/shifts/working-days** (data-driven UI + DB; no engine logic change): additive migration (`roles`/`shift_types` `is_active`+`sort`; `workplace_settings.working_days`); Settings managers for roles & shifts & working-days; soft-delete (`is_active=false`); make UI read role/shift meta from DB (helpers replace hardcoded `ROLE_META`/`SHIFT_META` in WeekTable, RoleChip, MeSummary, employee-summary, requests UI, schedule image).
3. **Engine** (TDD, defaults preserved): thread shift `start_hour/hours` into `EngineInput` so rest math uses real times (fallback `SHIFT_META`); initialize the grid's roles from input instead of the fixed `ROLES` constant. Shabbat, 12h fallback, matching, fairness, must-accept unchanged.

## Verification
Per phase: unit + tsc + lint + build + e2e green, files ≤200 lines, migrations applied to cloud, 369 existing engine tests unchanged. End-to-end: register → org+workplace → add 2nd workplace → switch → configure roles/shifts/times/working-days/counts → generate+publish correct schedules for both; invite ties to the chosen workplace; seeded demo still schedules identically.
