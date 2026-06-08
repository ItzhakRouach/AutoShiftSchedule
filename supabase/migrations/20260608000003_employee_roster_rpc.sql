-- 20260608000003_employee_roster_rpc.sql
-- Tighten coworker visibility. Migration 20260608000001 added
-- `employees_member_select`, which let any workplace member SELECT the WHOLE
-- employees row of every coworker (phone, observances, shift bounds, …) via the
-- API — far more than the published schedule needs. RLS is row-level, not
-- column-level, and managers + employees share the `authenticated` role, so we
-- can't restrict columns with GRANTs without breaking the manager team page.
--
-- Instead: expose a SECURITY DEFINER function that returns ONLY the roster
-- columns the schedule grid needs (id, name, color) to workplace members, and
-- DROP the broad row policy. Employees still read their OWN row via
-- `employees_self_select`; managers still read full rows via `owns_workplace`.

create or replace function public.workplace_roster(wp uuid)
returns table (id uuid, name text, color text)
language sql
security definer
stable
set search_path = public
as $$
  select e.id, e.name, e.color
  from employees e
  where e.workplace_id = wp
    and public.is_workplace_member(wp)
  order by e.name;
$$;

grant execute on function public.workplace_roster(uuid) to authenticated;

-- Remove the over-broad coworker row policy (roster now comes from the RPC).
drop policy if exists employees_member_select on employees;
