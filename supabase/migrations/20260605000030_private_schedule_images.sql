-- 20260605000030_private_schedule_images.sql — F-01 / F-02 fix.
-- Make the `schedule-images` bucket PRIVATE. The previous public bucket let
-- anyone with a project URL + a guessable period UUID fetch any tenant's
-- schedule PNG (employee names + weekly arrangement) with no auth. From now
-- on the WhatsApp share flow uses time-limited signed URLs (7-day TTL) and
-- storage paths are namespaced by workplace_id so a leaked period UUID is
-- useless for guessing other workplaces' assets.

-- Flip the bucket to private. `on conflict` so this migration is idempotent
-- if the bucket was already toggled by hand.
update storage.buckets set public = false where id = 'schedule-images';

-- Drop the prior "everyone can read" policy — uploads stay manager-only.
drop policy if exists "public read schedule images" on storage.objects;
drop policy if exists "managers can upload schedule images" on storage.objects;

-- Service role bypasses RLS so the cron publish + manager publish flows that
-- use createAdminClient() continue to work without changes.
-- For interactive sessions: managers can read/write objects whose path's first
-- segment matches a workplace they own.
create policy "schedule_images_manager_rw"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'schedule-images'
    and exists (
      select 1 from public.workplaces w
      where w.id::text = split_part(storage.objects.name, '/', 1)
        and public.owns_workplace(w.id)
    )
  )
  with check (
    bucket_id = 'schedule-images'
    and exists (
      select 1 from public.workplaces w
      where w.id::text = split_part(storage.objects.name, '/', 1)
        and public.owns_workplace(w.id)
    )
  );
