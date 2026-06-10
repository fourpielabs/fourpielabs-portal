-- =============================================================================
-- 20260610010006_storage.sql
-- Private Storage bucket `client-files` (spec §4 "Storage"). Path convention:
--   {client_id}/{uuid}-{filename}  => the first path segment is the client_id.
-- Policies mirror the table rules. Downloads happen via short-lived signed URLs
-- minted by server actions; clients only get SELECT on their own folder.
-- (RLS on storage.objects is enabled by default on Supabase.)
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('client-files', 'client-files', false)
on conflict (id) do nothing;

-- admin: full access to the bucket
create policy "client_files_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'client-files' and app.is_admin())
  with check (bucket_id = 'client-files' and app.is_admin());

-- team: full access within folders of their assigned clients
-- (upsert needs INSERT + SELECT + UPDATE, all covered by FOR ALL)
create policy "client_files_team_all" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'client-files'
    and app.is_assigned( ((storage.foldername(name))[1])::uuid )
  )
  with check (
    bucket_id = 'client-files'
    and app.is_assigned( ((storage.foldername(name))[1])::uuid )
  );

-- client: read-only on their own client folder
create policy "client_files_client_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-files'
    and ((storage.foldername(name))[1])::uuid = app.my_client_id()
  );
