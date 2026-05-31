-- 20260531000007_ensure_period_rpc.sql — lazy creation of a week's schedule
-- period. Employees can only SELECT schedule_periods under RLS, so they call
-- this SECURITY DEFINER function to ensure the upcoming week's period exists.
-- Authorization: caller must be the workplace owner OR an employee of it.

create or replace function public.ensure_upcoming_period(wp uuid, wk date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if not (
    public.owns_workplace(wp)
    or exists (select 1 from employees e where e.workplace_id = wp and e.user_id = auth.uid())
  ) then
    raise exception 'not authorized for workplace %', wp;
  end if;

  insert into schedule_periods (workplace_id, week_start_date)
  values (wp, wk)
  on conflict (workplace_id, week_start_date) do nothing;

  select id into pid
  from schedule_periods
  where workplace_id = wp and week_start_date = wk;

  return pid;
end;
$$;
