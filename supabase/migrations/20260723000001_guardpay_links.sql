-- 20260723000001_guardpay_links.sql — GuardPay (external salary app) integration.
-- guardpay_links: one row per employee — their linked GuardPay (Appwrite) account.
-- guardpay_syncs: one row per employee×period — "this week was imported" marker.
-- Self-only RLS: the employee owns both; managers have no access (wage privacy).

create table if not exists guardpay_links (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null unique references employees(id) on delete cascade,
  guardpay_user_id text not null,
  guardpay_email   text not null,
  guardpay_name    text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists guardpay_syncs (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  period_id   uuid not null references schedule_periods(id) on delete cascade,
  synced_at   timestamptz not null default now(),
  shift_count smallint not null default 0,
  unique (employee_id, period_id)
);
create index if not exists guardpay_syncs_employee_idx on guardpay_syncs(employee_id);

alter table guardpay_links enable row level security;
alter table guardpay_syncs enable row level security;

create policy guardpay_links_self on guardpay_links
  for all
  using (exists (select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()))
  with check (exists (select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()));

create policy guardpay_syncs_self on guardpay_syncs
  for all
  using (exists (select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()))
  with check (exists (select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()));
