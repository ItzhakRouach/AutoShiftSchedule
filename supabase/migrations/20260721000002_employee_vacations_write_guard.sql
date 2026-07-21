drop policy if exists vacations_employee_all on employee_vacations;

create policy vacations_employee_select on employee_vacations
  for select using (is_my_employee(employee_id));

-- Self-service inserts: an ordinary vacation must await approval; מילואים is
-- auto-approved by product decision. Employees can never self-mark מחלה.
create policy vacations_employee_insert on employee_vacations
  for insert with check (
    is_my_employee(employee_id)
    and (
      (kind = 'vacation' and status = 'pending')
      or (kind = 'miluim' and status = 'approved')
    )
  );

-- No employee UPDATE policy: the only update path is manager approval.

create policy vacations_employee_delete on employee_vacations
  for delete using (is_my_employee(employee_id));
