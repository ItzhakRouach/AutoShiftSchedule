-- 20260531000003_employees_invites.sql — employees, their roles, and invites.
-- An employee belongs to a workplace; may be linked to an auth user once they
-- join via an invite code. Multi-role via the employee_roles junction table.

-- ── Employees ────────────────────────────────────────────────────────────────
create table if not exists employees (
  id                  uuid primary key default gen_random_uuid(),
  workplace_id        uuid not null references workplaces(id) on delete cascade,
  user_id             uuid references auth.users(id) on delete set null,  -- null until they join
  name                text not null check (char_length(name) between 1 and 120),
  phone               text,
  color               text not null default '#3457F0',
  min_shifts_per_week smallint not null default 0,
  observes_shabbat    boolean  not null default false,
  observes_holidays   boolean  not null default false,
  must_accept         boolean  not null default false,   -- requests always honored
  status              text     not null default 'pending' check (status in ('pending','active')),
  created_at          timestamptz not null default now()
);
create index if not exists employees_workplace_idx on employees(workplace_id);
create index if not exists employees_user_idx on employees(user_id);

-- ── Employee ↔ role (multi-role) ─────────────────────────────────────────────
create table if not exists employee_roles (
  employee_id uuid not null references employees(id) on delete cascade,
  role_id     uuid not null references roles(id) on delete cascade,
  primary key (employee_id, role_id)
);

-- ── Invites ──────────────────────────────────────────────────────────────────
create table if not exists invites (
  id           uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references workplaces(id) on delete cascade,
  code         text not null unique,
  created_by   uuid references auth.users(id) on delete set null,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists invites_workplace_idx on invites(workplace_id);

-- ── Helper: does the current user own the workplace of an employee row? ───────
create or replace function public.owns_employee(emp uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from employees e where e.id = emp and public.owns_workplace(e.workplace_id)
  );
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table employees      enable row level security;
alter table employee_roles enable row level security;
alter table invites        enable row level security;

-- employees: the owning manager has full control; an employee can read their own row.
create policy employees_manager_all on employees
  for all using (owns_workplace(workplace_id)) with check (owns_workplace(workplace_id));
create policy employees_self_select on employees
  for select using (user_id = auth.uid());

-- employee_roles: managed by the owning manager (scoped via the employee's workplace).
create policy employee_roles_manager_all on employee_roles
  for all using (owns_employee(employee_id)) with check (owns_employee(employee_id));
create policy employee_roles_self_select on employee_roles
  for select using (exists (
    select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()
  ));

-- invites: only the owning manager can manage/read. Redemption by a joining
-- employee happens server-side via the service-role key (bypasses RLS).
create policy invites_manager_all on invites
  for all using (owns_workplace(workplace_id)) with check (owns_workplace(workplace_id));
