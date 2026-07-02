-- 20260703000001_assignments_twelve_fills.sql — persist the REAL 12h fill plan
-- instead of forcing the view to guess it from a single role_id.
--
-- A 12h assignment row today carries only one role_id (the "first covered
-- role"), even though the engine's TwelveHourAssignment.rolesByShift may put a
-- DIFFERENT role in each base-shift window it fills (cross-role is legal).
-- The view then reconstructs placement heuristically from TWELVE_HOUR_FILLS,
-- which mis-renders cross-role plans (stacked chips, phantom uncovered cells).
--
-- twelve_fills stores the ordered fill plan for the row: a jsonb array of
-- {shift: 'morning'|'noon'|'night', role_id: uuid} in TWELVE_HOUR_FILLS[variant]
-- order. NULL means "legacy row" — the view falls back to today's heuristic
-- (byte-identical behavior for all pre-existing rows). This migration is
-- WRITE-PATH ONLY: no view/rendering changes ship with it, and no RLS change
-- is needed (same row, same existing policies).
alter table assignments add column if not exists twelve_fills jsonb;

comment on column assignments.twelve_fills is
  'Real 12h fill plan: ordered jsonb array [{shift, role_id}], one entry per base-shift window this row fills, in TWELVE_HOUR_FILLS[variant] order. NULL = legacy row; the read path falls back to the pre-existing single-role heuristic.';
