-- 20260724000001_schedule_seen.sql — in-app "new schedule published" banner.
-- schedule_periods.published_at: when the period was last published (drives the
--   "new since you last looked" comparison). NULL for never-published periods.
-- schedule_seen: one row per employee — when they last viewed the schedule.
-- The employee's /me banner shows when latest published_at > their seen_at.

alter table schedule_periods add column if not exists published_at timestamptz;

create table if not exists schedule_seen (
  employee_id uuid primary key references employees(id) on delete cascade,
  seen_at     timestamptz not null default now()
);

alter table schedule_seen enable row level security;

-- Self-only: the employee owns their own seen-marker; nobody else reads/writes it.
create policy schedule_seen_self on schedule_seen
  for all
  using (exists (select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()))
  with check (exists (select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()));
