-- 20260608000002_employee_role_seniority.sql
-- Per-role seniority. A worker who holds a role can be marked SENIOR for that
-- role; senior holders are favored for that role's shifts over regular holders
-- (the role still splits evenly within a tier). Soft scheduling signal only —
-- see src/lib/scheduling. Default false ⇒ existing rows stay regular, so the
-- role keeps splitting evenly across all holders until a manager marks seniors.
alter table employee_roles
  add column if not exists is_senior boolean not null default false;
