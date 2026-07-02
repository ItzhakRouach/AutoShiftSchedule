-- 20260702000003_absence_sick_kind.sql
-- The manager-facing "vacation" affordance is renamed to the umbrella term
-- היעדרות (absence) and gains a third kind: מחלה (sick). Same mechanism as
-- vacation/miluim — a hard-off range for the scheduler, distinguished only by
-- `kind` in the UI. Widen the check constraint added in
-- 20260702000002_vacation_kind.sql to also allow 'sick'.
alter table employee_vacations
  drop constraint if exists employee_vacations_kind_check;
alter table employee_vacations
  add constraint employee_vacations_kind_check check (kind in ('vacation', 'miluim', 'sick'));
