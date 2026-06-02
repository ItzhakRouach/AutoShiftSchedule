-- Modular config: soft-delete (active) for roles + shift types, and a per-workplace
-- working-days set. All additive with safe defaults so existing workplaces are
-- unchanged (every day active, every role/shift active).

alter table roles add column if not exists is_active boolean not null default true;
alter table shift_types add column if not exists is_active boolean not null default true;
alter table workplace_settings
  add column if not exists working_days int[] not null default '{0,1,2,3,4,5,6}';
