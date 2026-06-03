-- Per-employee day notes (e.g. רענון / השתלמות / free text). A note marks the
-- employee as NOT working that day (their shift is removed) but with a label the
-- employee can see. One note per (period, employee, day).
create table if not exists day_notes (
  id          uuid primary key default gen_random_uuid(),
  period_id   uuid not null references schedule_periods(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  label       text not null,
  created_at  timestamptz not null default now(),
  unique (period_id, employee_id, day_of_week)
);

create index if not exists day_notes_period_idx on day_notes(period_id);

alter table day_notes enable row level security;

-- Manager who owns the period's workplace manages the notes.
create policy day_notes_manager_all on day_notes
  for all using (owns_period(period_id)) with check (owns_period(period_id));

-- Employee reads their own notes once the period is published.
create policy day_notes_self_select on day_notes
  for select using (
    is_my_employee(employee_id)
    and exists (
      select 1 from schedule_periods sp where sp.id = period_id and sp.status = 'published'
    )
  );
