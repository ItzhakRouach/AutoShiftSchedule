-- 20260702000001_manager_vacations.sql
-- Managers can create/approve/remove vacations directly for their workplace's
-- employees (e.g. from the schedule "בקשות עובדים" view), not just approve
-- employee-submitted ones. RLS policies are permissive/OR'd, so adding this
-- FOR ALL policy alongside the existing vacations_manager_select (read-only)
-- is safe — it only widens manager access, never narrows employee access.
-- This also enables dropping the service-role bypass previously needed in
-- the vacation-approval flow (src/app/(manager)/dashboard/vacation-actions.ts).
create policy vacations_manager_write on employee_vacations
  for all using (owns_employee(employee_id)) with check (owns_employee(employee_id));
