-- Let employees read their workplace's settings (so the requests page can show
-- the request-submission deadline). Writes stay manager-only via the existing
-- workplace_settings_all policy.
create policy workplace_settings_member_select on workplace_settings
  for select using (
    exists (
      select 1 from employees e
      where e.workplace_id = workplace_settings.workplace_id
        and e.user_id = auth.uid()
    )
  );
