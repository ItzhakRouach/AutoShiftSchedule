-- 20260610000003_requests_compound_indexes.sql
-- The requests table is queried by (period_id, day_of_week) — the
-- off_count_for_day RPC and saveDayRequest's per-day cap check — and by
-- (period_id, employee_id) for per-employee request loads. Only single-column
-- indexes existed; add the compound indexes (mirrors the assignments table).
create index if not exists idx_requests_period_dow on requests(period_id, day_of_week);
create index if not exists idx_requests_period_employee on requests(period_id, employee_id);
