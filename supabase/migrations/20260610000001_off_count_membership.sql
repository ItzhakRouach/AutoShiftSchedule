-- 20260610000001_off_count_membership.sql
-- Harden off_count_for_day: it is SECURITY DEFINER and callable directly via the
-- API, so it MUST verify the caller belongs to the period's workplace. Without
-- this guard a worker could pass another workplace's period UUID and learn how
-- many of that workplace's workers are off on a given day (info disclosure).
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
    and r.employee_id <> p_exclude
    -- Authorization: caller must be a member of the period's workplace.
    and exists (
      select 1 from schedule_periods sp
      where sp.id = p_period
        and public.is_workplace_member(sp.workplace_id)
    );
$$;
