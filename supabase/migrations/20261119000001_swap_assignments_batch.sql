-- All-or-nothing batch of swaps for the AI improvement (apply AND undo).
--
-- `swap_assignments` runs one swap per call, so a batch could be left half
-- written if a later call failed. This runs every swap in ONE transaction:
-- any failure rolls the whole batch back. It also checks, for each swap, that
-- both workers still hold exactly the expected 8h cell before moving them —
-- the single-swap RPC deletes by (employee, day) only, so a concurrent edit
-- could have been moved blindly.
--
-- p_swaps: jsonb array of objects shaped like swap_assignments' arguments:
--   { a_employee, a_from_day, a_to_day, a_to_shift, a_to_role, a_source,
--     b_employee, b_from_day, b_to_day, b_to_shift, b_to_role, b_source }
-- A crosses into B's cell and B into A's, so A's CURRENT cell is
-- (a_from_day, b_to_shift, b_to_role) and B's is (b_from_day, a_to_shift, a_to_role).
--
-- SECURITY INVOKER: the manager's own RLS (assignments_manager_all) applies,
-- on top of the explicit owns_period guard. Additive — nothing existing changes.

create or replace function public.swap_assignments_batch(p_period uuid, p_swaps jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  s jsonb;
  n int;
begin
  if not public.owns_period(p_period) then
    raise exception 'not authorized for period %', p_period;
  end if;
  if jsonb_typeof(p_swaps) <> 'array' or jsonb_array_length(p_swaps) = 0 then
    raise exception 'ai_swap_bad_input';
  end if;

  -- Serialize against other writers on this period for the whole batch.
  perform 1 from assignments where period_id = p_period for update;

  for s in select * from jsonb_array_elements(p_swaps) loop
    -- Vacate A's current cell: must be exactly the expected plain 8h row.
    delete from assignments a
    using shift_types st
    where a.period_id = p_period
      and a.employee_id = (s->>'a_employee')::uuid
      and a.day_of_week = (s->>'a_from_day')::int
      and a.shift_type_id = (s->>'b_to_shift')::uuid
      and a.role_id = (s->>'b_to_role')::uuid
      and a.twelve_fills is null
      and st.id = a.shift_type_id
      and st.key in ('morning', 'noon', 'night');
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'ai_swap_stale';
    end if;

    delete from assignments a
    using shift_types st
    where a.period_id = p_period
      and a.employee_id = (s->>'b_employee')::uuid
      and a.day_of_week = (s->>'b_from_day')::int
      and a.shift_type_id = (s->>'a_to_shift')::uuid
      and a.role_id = (s->>'a_to_role')::uuid
      and a.twelve_fills is null
      and st.id = a.shift_type_id
      and st.key in ('morning', 'noon', 'night');
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'ai_swap_stale';
    end if;

    -- A unique (period, employee, day) clash here means the worker was given
    -- another shift on the destination day — the whole batch rolls back.
    insert into assignments (period_id, employee_id, day_of_week, shift_type_id, role_id, source, twelve_fills)
    values (p_period, (s->>'a_employee')::uuid, (s->>'a_to_day')::int,
            (s->>'a_to_shift')::uuid, (s->>'a_to_role')::uuid, s->>'a_source', null);
    insert into assignments (period_id, employee_id, day_of_week, shift_type_id, role_id, source, twelve_fills)
    values (p_period, (s->>'b_employee')::uuid, (s->>'b_to_day')::int,
            (s->>'b_to_shift')::uuid, (s->>'b_to_role')::uuid, s->>'b_source', null);
  end loop;
end;
$$;

grant execute on function public.swap_assignments_batch(uuid, jsonb) to authenticated;
