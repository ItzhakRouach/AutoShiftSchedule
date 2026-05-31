-- 20260531000011_holidays.sql — per-workplace holiday calendar. A row marks a
-- DATE as a holiday ("chag"). The scheduling adapter derives, for each day:
--   isHoliday    = that date is in this table
--   isHolidayEve = the NEXT date is in this table (erev chag)
-- Holiday-observing employees are then blocked like Shabbat around these dates.

create table if not exists holidays (
  id           uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references workplaces(id) on delete cascade,
  date         date not null,
  name         text not null,
  created_at   timestamptz not null default now(),
  unique (workplace_id, date)
);
create index if not exists holidays_workplace_idx on holidays(workplace_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table holidays enable row level security;

-- Manager (workplace owner) manages the calendar.
create policy holidays_manager_all on holidays
  for all using (owns_workplace(workplace_id)) with check (owns_workplace(workplace_id));

-- Employees of the workplace can read it (transparency).
create policy holidays_employee_select on holidays
  for select using (exists (
    select 1 from employees e
    where e.workplace_id = holidays.workplace_id and e.user_id = auth.uid()
  ));
