-- 20260917000001_slot_marks.sql — manager marks on intentionally-empty cells.
--
-- A (day, shift, role) slot that the manager deliberately leaves unstaffed —
-- e.g. יום כיפור, where only a skeleton crew works — currently renders as a red
-- "לא מאויש" gap and is counted in every coverage warning. A slot_mark says
-- "this emptiness is on purpose", carries an optional free-text caption shown
-- inside the cell, and removes the slot from the gap counters.
--
-- `label` may be '' (a plain blank cell with no caption) — membership in this
-- table, not the text, is what marks the slot.
create table if not exists slot_marks (
  id            uuid primary key default gen_random_uuid(),
  period_id     uuid not null references schedule_periods(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6),
  shift_type_id uuid not null references shift_types(id) on delete cascade,
  role_id       uuid not null references roles(id) on delete cascade,
  label         text not null default '' check (char_length(label) <= 30),
  created_at    timestamptz not null default now(),
  unique (period_id, day_of_week, shift_type_id, role_id)
);

create index if not exists slot_marks_period_idx on slot_marks(period_id);

alter table slot_marks enable row level security;

-- The manager who owns the period's workplace manages the marks.
create policy slot_marks_manager_all on slot_marks
  for all using (owns_period(period_id)) with check (owns_period(period_id));

-- Any workplace member reads the marks of a PUBLISHED period — the caption is
-- part of the schedule they see. Mirrors assignments_published_select.
create policy slot_marks_published_select on slot_marks
  for select using (
    exists (
      select 1 from schedule_periods sp
      where sp.id = slot_marks.period_id
        and sp.status = 'published'
        and public.is_workplace_member(sp.workplace_id)
    )
  );
