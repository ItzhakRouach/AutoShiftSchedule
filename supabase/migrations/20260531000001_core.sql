-- 20260531000001_core.sql — organizations, workplaces, roles, shift types,
-- staffing requirements, and workplace settings, with Row-Level Security.
-- A user (manager) owns organizations; everything else is scoped to a workplace
-- the user owns through its organization.

-- ── Tables ───────────────────────────────────────────────────────────────────
create table if not exists organizations (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  created_at    timestamptz not null default now()
);

create table if not exists workplaces (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  timezone    text not null default 'Asia/Jerusalem',
  week_start  smallint not null default 0,         -- 0 = Sunday (Israel)
  created_at  timestamptz not null default now()
);
create index if not exists workplaces_org_id_idx on workplaces(org_id);

create table if not exists roles (
  id           uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references workplaces(id) on delete cascade,
  name         text not null,
  color        text not null default '#3457F0',
  created_at   timestamptz not null default now(),
  unique (workplace_id, name)
);

create table if not exists shift_types (
  id           uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references workplaces(id) on delete cascade,
  key          text not null,                       -- morning|noon|night|m12_*
  name         text not null,
  start_hour   smallint not null,
  hours        smallint not null,
  color        text not null,
  is_fallback  boolean not null default false,      -- true for 12h variants
  sort         smallint not null default 0,
  created_at   timestamptz not null default now(),
  unique (workplace_id, key)
);

create table if not exists shift_requirements (
  id            uuid primary key default gen_random_uuid(),
  workplace_id  uuid not null references workplaces(id) on delete cascade,
  day_of_week   smallint not null,                  -- 0..6, 0 = Sunday
  shift_type_id uuid not null references shift_types(id) on delete cascade,
  role_id       uuid not null references roles(id) on delete cascade,
  count         smallint not null default 0,
  unique (workplace_id, day_of_week, shift_type_id, role_id)
);
create index if not exists shift_requirements_wp_idx on shift_requirements(workplace_id);

create table if not exists workplace_settings (
  workplace_id          uuid primary key references workplaces(id) on delete cascade,
  request_deadline_dow  smallint,                   -- 0..6, nullable until set
  request_deadline_time time,
  publish_dow           smallint,
  publish_time          time,
  min_rest_hours        smallint not null default 8,
  ideal_rest_hours      smallint not null default 16,
  allow_12h_fallback    boolean  not null default true,
  greenapi_instance     text,
  greenapi_token        text,
  greenapi_group        text,
  updated_at            timestamptz not null default now()
);

-- ── Ownership helper ─────────────────────────────────────────────────────────
create or replace function public.owns_workplace(wp uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from workplaces w
    join organizations o on o.id = w.org_id
    where w.id = wp and o.owner_user_id = auth.uid()
  );
$$;

-- ── Row-Level Security ───────────────────────────────────────────────────────
alter table organizations      enable row level security;
alter table workplaces         enable row level security;
alter table roles              enable row level security;
alter table shift_types        enable row level security;
alter table shift_requirements enable row level security;
alter table workplace_settings enable row level security;

-- organizations: owner only
create policy organizations_select on organizations
  for select using (owner_user_id = auth.uid());
create policy organizations_insert on organizations
  for insert with check (owner_user_id = auth.uid());
create policy organizations_update on organizations
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy organizations_delete on organizations
  for delete using (owner_user_id = auth.uid());

-- workplaces: via owning organization
create policy workplaces_all on workplaces
  for all
  using (exists (select 1 from organizations o where o.id = org_id and o.owner_user_id = auth.uid()))
  with check (exists (select 1 from organizations o where o.id = org_id and o.owner_user_id = auth.uid()));

-- workplace-scoped tables: via owns_workplace()
create policy roles_all on roles
  for all using (owns_workplace(workplace_id)) with check (owns_workplace(workplace_id));
create policy shift_types_all on shift_types
  for all using (owns_workplace(workplace_id)) with check (owns_workplace(workplace_id));
create policy shift_requirements_all on shift_requirements
  for all using (owns_workplace(workplace_id)) with check (owns_workplace(workplace_id));
create policy workplace_settings_all on workplace_settings
  for all using (owns_workplace(workplace_id)) with check (owns_workplace(workplace_id));
