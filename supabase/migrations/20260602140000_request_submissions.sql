-- Per-employee "submitted my requests" marker for a period. The employee can
-- edit and re-submit while the period is still 'collecting'; this records the
-- latest submission time so the UI can confirm it.
create table if not exists request_submissions (
  period_id    uuid not null references schedule_periods(id) on delete cascade,
  employee_id  uuid not null references employees(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (period_id, employee_id)
);

alter table request_submissions enable row level security;

-- Employee owns their own submission rows; manager can read them.
create policy request_submissions_employee_all on request_submissions
  for all using (is_my_employee(employee_id)) with check (is_my_employee(employee_id));
create policy request_submissions_manager_select on request_submissions
  for select using (owns_employee(employee_id));
