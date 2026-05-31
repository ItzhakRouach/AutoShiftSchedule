-- Allow employees to read the workplace they belong to.
-- This is needed so the /me page can display the workplace name.
create policy workplaces_employee_select on workplaces
  for select
  using (
    exists (
      select 1 from employees e
      where e.workplace_id = id
        and e.user_id = auth.uid()
    )
  );
