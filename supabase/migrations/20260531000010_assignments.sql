-- 20260531000010_assignments.sql — the generated schedule output: one row per
-- assigned (period, employee, day, shift, role). `source` distinguishes engine
-- output from manual edits / approved 12h shifts.

create table if not exists assignments (
  id            uuid primary key default gen_random_uuid(),
  period_id     uuid not null references schedule_periods(id) on delete cascade,
  employee_id   uuid not null references employees(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6),
  shift_type_id uuid not null references shift_types(id) on delete cascade,
  role_id       uuid not null references roles(id) on delete cascade,
  source        text not null default 'auto'
                  check (source in ('auto','manual','fallback_12h')),
  created_at    timestamptz not null default now(),
  unique (period_id, employee_id, day_of_week)        -- one shift/employee/day
);
create index if not exists assignments_period_idx on assignments(period_id);
create index if not exists assignments_employee_idx on assignments(employee_id);

-- ── Helper: does the current user own the workplace of a period? ──────────────
create or replace function public.owns_period(p uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from schedule_periods sp
    where sp.id = p and public.owns_workplace(sp.workplace_id)
  );
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table assignments enable row level security;

-- Manager (workplace owner) has full control over assignments in their periods.
create policy assignments_manager_all on assignments
  for all using (owns_period(period_id)) with check (owns_period(period_id));

-- An employee can read their OWN assignments (only once the period is published).
create policy assignments_self_select on assignments
  for select using (
    is_my_employee(employee_id)
    and exists (
      select 1 from schedule_periods sp
      where sp.id = period_id and sp.status = 'published'
    )
  );
