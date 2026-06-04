-- 20260605000040_employees_unique_user.sql — F-03 fix.
-- Enforce one workplace per authenticated user on the employee side. Without
-- this, a user with rows in multiple workplaces silently resolves to whichever
-- one Postgres returns first (`.limit(1)` in src/lib/auth/role.ts and
-- src/app/(employee)/me/requests/actions.ts) and their second-workplace
-- actions become partially unreachable. The product currently has no UI for
-- switching active workplace on the employee side, so the safe answer is to
-- forbid the situation at the data layer.

-- Two `employees` rows with `user_id IS NULL` are allowed (pending employees
-- pre-redemption). Partial-unique applies only to rows that have been claimed
-- by an auth user.
create unique index if not exists employees_user_unique
  on employees (user_id)
  where user_id is not null;
