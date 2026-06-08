-- 20260608000001_employee_full_schedule_read.sql
-- Let any workplace member (employee) read the data needed to render the FULL
-- published weekly schedule — the same grid the manager sees. Until now an
-- employee could only read their OWN assignments + their OWN employee row, and
-- had NO read on `roles` at all, so the schedule grid (keyed by role) rendered
-- empty. These additive SELECT policies fix that. Writes stay manager-only via
-- the existing *_all / *_manager_all policies. Mirrors the membership pattern in
-- 20260531000008_shift_types_employee_read.sql and 20260602150000_workplace_settings_member_read.sql.

-- ── Membership helper ─────────────────────────────────────────────────────────
-- SECURITY DEFINER so the lookup bypasses RLS — essential for the employees
-- policy below, where an inline `exists (select … from employees)` inside a
-- policy *on* employees would recurse.
create or replace function public.is_workplace_member(wp uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from employees e
    where e.workplace_id = wp and e.user_id = auth.uid()
  );
$$;

-- ── Additive read policies ───────────────────────────────────────────────────
-- roles: members can read their workplace's roles (non-sensitive labels).
create policy roles_member_select on roles
  for select using (is_workplace_member(workplace_id));

-- employees: members can read the full roster of their workplace (names/colors
-- for the grid). Additive to employees_self_select.
create policy employees_member_select on employees
  for select using (is_workplace_member(workplace_id));

-- assignments: members can read ALL assignments of a PUBLISHED period in their
-- workplace. Additive to assignments_self_select; scoped to published so nothing
-- leaks before publish.
create policy assignments_published_select on assignments
  for select using (
    exists (
      select 1 from schedule_periods sp
      where sp.id = assignments.period_id
        and sp.status = 'published'
        and public.is_workplace_member(sp.workplace_id)
    )
  );
