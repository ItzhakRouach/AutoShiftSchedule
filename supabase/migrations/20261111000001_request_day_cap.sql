-- Weekly cap on REQUEST DAYS per employee (any day with a request — off or
-- preferred shift — counts once). Manager-owned, NULL = no limit; default 3 so
-- every existing and new workplace starts capped. Postgres backfills existing
-- rows with the default on ADD COLUMN ... DEFAULT.
alter table workplace_settings
  add column if not exists max_request_days_per_week smallint default 3;
alter table workplace_settings
  drop constraint if exists workplace_settings_max_request_days_per_week_check;
alter table workplace_settings
  add constraint workplace_settings_max_request_days_per_week_check
  check (max_request_days_per_week is null or max_request_days_per_week between 1 and 7);

-- Per-employee exemption: the manager flips "ללא הגבלת בקשות" on /team.
alter table employees
  add column if not exists unlimited_requests boolean not null default false;
