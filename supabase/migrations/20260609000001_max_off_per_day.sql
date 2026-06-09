-- 20260609000001_max_off_per_day.sql
-- Per-DAY off cap: limit how many workers can request off on the same day, so a
-- day doesn't become impossible to staff. Nullable (NULL = no cap). Enforced at
-- request submission; the engine's coverage-rescue still handles any residual
-- shortfall after this preventive cap.
alter table workplace_settings
  add column if not exists max_off_per_day smallint;

-- Count how many OTHER employees already requested off on a given period+day.
-- SECURITY DEFINER because a worker can't read coworkers' requests under RLS.
create or replace function public.off_count_for_day(p_period uuid, p_day int, p_exclude uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int
  from requests r
  where r.period_id = p_period
    and r.day_of_week = p_day
    and r.is_off = true
    and r.employee_id <> p_exclude;
$$;

grant execute on function public.off_count_for_day(uuid, int, uuid) to authenticated;
