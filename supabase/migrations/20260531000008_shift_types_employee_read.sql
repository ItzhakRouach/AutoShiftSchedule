-- Allow employees to read shift types for their own workplace.
-- This is needed so /me/requests can display selectable preferred shifts.
create policy shift_types_employee_select on shift_types
  for select
  using (
    exists (
      select 1 from employees e
      where e.workplace_id = shift_types.workplace_id
        and e.user_id = auth.uid()
    )
  );
