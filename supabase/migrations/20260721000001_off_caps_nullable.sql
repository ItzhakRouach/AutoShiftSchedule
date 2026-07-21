-- Weekly cap: manager-owned, NULL = no limit. The old NOT NULL DEFAULT 2 was
-- system-imposed, never manager-chosen — reset ALL rows to NULL (unlimited).
alter table workplace_settings alter column max_off_days_per_week drop not null;
alter table workplace_settings alter column max_off_days_per_week drop default;
update workplace_settings set max_off_days_per_week = null;
alter table workplace_settings
  drop constraint if exists workplace_settings_max_off_days_per_week_check;
alter table workplace_settings
  add constraint workplace_settings_max_off_days_per_week_check
  check (max_off_days_per_week is null or max_off_days_per_week between 1 and 7);

-- Per-day cap: 0 was a footgun (>= 0 always true → blocks every off-request).
update workplace_settings set max_off_per_day = null where max_off_per_day <= 0;
alter table workplace_settings
  drop constraint if exists workplace_settings_max_off_per_day_check;
alter table workplace_settings
  add constraint workplace_settings_max_off_per_day_check
  check (max_off_per_day is null or max_off_per_day >= 1);
