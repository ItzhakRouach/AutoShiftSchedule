-- 20260531000009_employee_scheduling_attrs.sql — scheduling attributes needed
-- by the engine: employment type, max shifts, and recurring availability.

-- ── Employee scheduling attributes ───────────────────────────────────────────
alter table employees
  add column if not exists employment_type text not null default 'full'
    check (employment_type in ('full','part','student')),
  add column if not exists max_shifts_per_week smallint;   -- null = derive from type/no cap

-- ── Recurring availability (which shifts an employee can work, by weekday) ─────
-- A row means "this employee CAN work this shift on this day-of-week".
-- If an employee has NO rows at all → unrestricted (available to every shift,
-- subject to the other constraints). If they have ≥1 row → restricted to exactly
-- those (day_of_week, shift_type) pairs.
create table if not exists employee_availability (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6),
  shift_type_id uuid not null references shift_types(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (employee_id, day_of_week, shift_type_id)
);
create index if not exists employee_availability_employee_idx on employee_availability(employee_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table employee_availability enable row level security;

-- Manager (owner) manages availability for their workplace's employees.
create policy employee_availability_manager_all on employee_availability
  for all using (owns_employee(employee_id)) with check (owns_employee(employee_id));

-- Employee can read their own availability.
create policy employee_availability_self_select on employee_availability
  for select using (is_my_employee(employee_id));
