-- 20260604000020_twelve_pair_snapshots.sql — restore state for cancelled 12h
-- pairs. On apply, the manager-facing flow captures the rows that the pair
-- overwrites (morning+night base assignments) or deletes (the freed noon
-- person) keyed by (period, day, role). On cancel the snapshot is replayed
-- via upsert so the day returns to the arrangement it had before the pair.

create table if not exists twelve_pair_snapshots (
  id          uuid primary key default gen_random_uuid(),
  period_id   uuid not null references schedule_periods(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  role_id     uuid not null references roles(id) on delete cascade,
  -- Array of {employee_id, shift_type_id, role_id, source} captured pre-pair.
  snapshot    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (period_id, day_of_week, role_id)
);

create index if not exists twelve_pair_snapshots_period_idx
  on twelve_pair_snapshots(period_id);

alter table twelve_pair_snapshots enable row level security;

-- Manager (workplace owner) full control — same gate as `assignments`.
create policy twelve_pair_snapshots_manager_all on twelve_pair_snapshots
  for all using (owns_period(period_id)) with check (owns_period(period_id));
