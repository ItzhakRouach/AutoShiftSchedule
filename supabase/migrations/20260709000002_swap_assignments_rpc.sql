-- Atomic swap/move of manual assignments (drag-to-swap in the schedule editor).
-- A swap exchanges two workers' cells (same-day or cross-day); a move (b_employee
-- null) relocates one worker and vacates their source cell. Runs in ONE
-- transaction so a half-swap can never persist. SECURITY DEFINER guarded by
-- owns_period (manager of the owning workplace only) — same precedent as
-- ensure_upcoming_period. `source` params let undo restore rows verbatim
-- (an auto row restored as auto keeps regenerate-preservation semantics).

create or replace function public.swap_assignments(
  p_period uuid,
  a_employee uuid,
  a_from_day int,
  a_to_day int,
  a_to_shift uuid,
  a_to_role uuid,
  a_source text default 'manual',
  b_employee uuid default null,
  b_from_day int default null,
  b_to_day int default null,
  b_to_shift uuid default null,
  b_to_role uuid default null,
  b_source text default 'manual'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not public.owns_period(p_period) then
    raise exception 'not authorized for period %', p_period;
  end if;

  -- Vacate sources first (unique (period, employee, day) frees the target keys).
  delete from assignments
  where period_id = p_period and employee_id = a_employee and day_of_week = a_from_day;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'source row missing for employee % day %', a_employee, a_from_day;
  end if;

  if b_employee is not null then
    delete from assignments
    where period_id = p_period and employee_id = b_employee and day_of_week = b_from_day;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'source row missing for employee % day %', b_employee, b_from_day;
    end if;
  end if;

  insert into assignments (period_id, employee_id, day_of_week, shift_type_id, role_id, source, twelve_fills)
  values (p_period, a_employee, a_to_day, a_to_shift, a_to_role, a_source, null);

  if b_employee is not null then
    insert into assignments (period_id, employee_id, day_of_week, shift_type_id, role_id, source, twelve_fills)
    values (p_period, b_employee, b_to_day, b_to_shift, b_to_role, b_source, null);
  end if;
end;
$$;
