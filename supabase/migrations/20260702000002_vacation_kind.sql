-- 20260702000002_vacation_kind.sql
-- Distinguishes ordinary vacation from military reserve duty (מילואים) on the
-- same employee_vacations mechanism — both are hard-off ranges for the
-- scheduler, so no new table or engine change is needed; only the label
-- differs in the UI. Managers set 'miluim' from the schedule requests view;
-- workers only self-serve 'vacation'.
alter table employee_vacations
  add column if not exists kind text not null default 'vacation'
  check (kind in ('vacation', 'miluim'));
