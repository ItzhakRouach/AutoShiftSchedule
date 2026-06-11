-- 20260611000001_assignments_temp_name.sql — allow ad-hoc "temp" worker names in
-- a schedule cell for people not in the employee roster (manager fills empty
-- cells before publishing). A temp row carries `temp_name` instead of an
-- `employee_id`; exactly one of the two is present.
--
-- Forward-only (project convention). Existing rows all have employee_id NOT NULL
-- and temp_name NULL, so the XOR check holds for them — no backfill needed.

-- employee_id becomes nullable so a temp row can omit it. The FK + ON DELETE
-- CASCADE stay intact (a NULL FK value is permitted).
alter table assignments alter column employee_id drop not null;

alter table assignments add column if not exists temp_name text;

-- Exactly one identity per row: a real employee OR a free-text temp name.
alter table assignments
  add constraint assignments_identity_chk
  check ((employee_id is not null) <> (temp_name is not null));

-- NOTE on unique(period_id, employee_id, day_of_week): Postgres treats NULLs as
-- DISTINCT, so temp rows (employee_id NULL) are never blocked by it and several
-- temp names may share a (period, day) — intended, since ad-hoc names carry no
-- one-shift-per-day rule. RLS is unchanged: assignments_manager_all keys on
-- owns_period(period_id); the employee self-select policy's is_my_employee(NULL)
-- never matches, so temp rows stay invisible to employees.
