-- 20260605000010_assignments_compound_indexes.sql — compound indexes covering
-- the hot read paths on `assignments`. Existing single-column indexes on
-- (period_id) and (employee_id) already exist; these add:
--   * (period_id, day_of_week)  — every day-level pair/edit fetch
--   * (period_id, employee_id)  — manual-edit validation, prior-deficit/tail
--   * (period_id, source)       — fallback_12h scoping on cancel + delete
-- The third is PARTIAL (only fallback_12h rows) — small, very selective, and
-- exactly the predicate the cancel path uses.

create index if not exists idx_assignments_period_dow
  on assignments (period_id, day_of_week);

create index if not exists idx_assignments_period_employee
  on assignments (period_id, employee_id);

create index if not exists idx_assignments_period_source_fb12
  on assignments (period_id, source)
  where source = 'fallback_12h';
