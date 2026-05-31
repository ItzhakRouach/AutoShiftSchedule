-- Fix employee → workplace read policy.
--
-- The original policy (0004) referenced an UNQUALIFIED `id` inside the
-- correlated subquery:
--   exists (select 1 from employees e where e.workplace_id = id and ...)
-- In that subquery, the unqualified `id` resolves to the INNER table
-- (employees.id) per SQL name-resolution scoping, so the condition became
-- effectively `e.workplace_id = e.id`, which is virtually never true.
-- Result: employees could NOT read their own workplace row.
--
-- This migration drops the broken policy and recreates it with the outer
-- table column explicitly qualified as `workplaces.id`.

drop policy if exists workplaces_employee_select on workplaces;

create policy workplaces_employee_select on workplaces
  for select
  using (
    exists (
      select 1 from employees e
      where e.workplace_id = workplaces.id
        and e.user_id = auth.uid()
    )
  );
