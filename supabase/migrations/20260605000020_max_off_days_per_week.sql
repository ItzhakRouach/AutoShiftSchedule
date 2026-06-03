-- 20260605000020_max_off_days_per_week.sql — per-workplace cap on how many
-- "יום חופש / לא זמין" requests each employee may file per period. Default 2,
-- range 0..7 (0 disables off-requests entirely, 7 effectively disables the cap).
-- Enforced by the employee-side saveDayRequest server action.

alter table workplace_settings
  add column if not exists max_off_days_per_week smallint not null default 2
    check (max_off_days_per_week between 0 and 7);
