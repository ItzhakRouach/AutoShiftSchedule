-- Create a PUBLIC storage bucket for published schedule images.
-- GreenAPI's sendFileByUrl requires a publicly accessible URL.

insert into storage.buckets (id, name, public)
values ('schedule-images', 'schedule-images', true)
on conflict (id) do nothing;

-- Allow authenticated managers (service role bypasses RLS automatically)
-- to insert / update objects in this bucket.
create policy "managers can upload schedule images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'schedule-images');

-- Explicit public read policy (belt-and-suspenders; public bucket already
-- allows anonymous reads by default in Supabase).
create policy "public read schedule images"
  on storage.objects for select
  to public
  using (bucket_id = 'schedule-images');
