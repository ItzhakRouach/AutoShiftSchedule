-- 20260531000006_requests.sql — weekly schedule periods, per-day employee
-- requests (preferred shifts / day-off), and multi-day vacation ranges.

-- ── Schedule periods (one per workplace per week) ─────────────────────────────
create table if not exists schedule_periods (
  id              uuid primary key default gen_random_uuid(),
  workplace_id    uuid not null references workplaces(id) on delete cascade,
  week_start_date date not null,                       -- Sunday of the week
  status          text not null default 'collecting'
                    check (status in ('collecting','locked','published')),
  created_at      timestamptz not null default now(),
  unique (workplace_id, week_start_date)
);
create index if not exists schedule_periods_workplace_idx on schedule_periods(workplace_id);

-- ── Per-day requests (employee × period × day) ────────────────────────────────
create table if not exists requests (
  id                  uuid primary key default gen_random_uuid(),
  period_id           uuid not null references schedule_periods(id) on delete cascade,
  employee_id         uuid not null references employees(id) on delete cascade,
  day_of_week         smallint not null check (day_of_week between 0 and 6),
  is_off              boolean  not null default false,  -- day off / unavailable
  preferred_shift_ids uuid[]   not null default '{}',   -- preferred shift_type ids
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (period_id, employee_id, day_of_week)
);
create index if not exists requests_period_idx on requests(period_id);
create index if not exists requests_employee_idx on requests(employee_id);

-- ── Multi-day vacation ranges (cross-week availability blocks) ────────────────
create table if not exists employee_vacations (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  date_from   date not null,
  date_to     date not null,
  created_at  timestamptz not null default now(),
  check (date_to >= date_from)
);
create index if not exists employee_vacations_employee_idx on employee_vacations(employee_id);

-- ── Helper: is this employee row owned by (linked to) the current user? ───────
create or replace function public.is_my_employee(emp uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from employees e where e.id = emp and e.user_id = auth.uid()
  );
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table schedule_periods   enable row level security;
alter table requests           enable row level security;
alter table employee_vacations enable row level security;

-- schedule_periods: manager (owner) full control; employees of the workplace can read.
create policy schedule_periods_manager_all on schedule_periods
  for all using (owns_workplace(workplace_id)) with check (owns_workplace(workplace_id));
create policy schedule_periods_employee_select on schedule_periods
  for select using (exists (
    select 1 from employees e
    where e.workplace_id = schedule_periods.workplace_id and e.user_id = auth.uid()
  ));

-- requests: the employee owns their own rows; the manager can read them.
create policy requests_employee_all on requests
  for all using (is_my_employee(employee_id)) with check (is_my_employee(employee_id));
create policy requests_manager_select on requests
  for select using (owns_employee(employee_id));

-- vacations: employee owns their own; manager can read.
create policy vacations_employee_all on employee_vacations
  for all using (is_my_employee(employee_id)) with check (is_my_employee(employee_id));
create policy vacations_manager_select on employee_vacations
  for select using (owns_employee(employee_id));
