-- 20260610000002_vacation_approval.sql
-- Vacation approval workflow: a worker's vacation request must be approved by a
-- manager before it counts as time off. New `status` column; only 'approved'
-- vacations are treated as hard-off by the scheduler.
alter table employee_vacations
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));

-- Backfill: vacations created before this feature were already in effect, so
-- keep them active (don't retroactively pull them out of live schedules).
update employee_vacations set status = 'approved' where status = 'pending';

create index if not exists employee_vacations_status_idx on employee_vacations(status);
