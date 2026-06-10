-- =============================================================================
-- 20260610010006_storage.sql
-- Private Storage bucket `client-files` (spec §4 "Storage"). Path convention:
--   {client_id}/{uuid}-{filename}  => the first path segment is the client_id.
-- Admin/team policies mirror the table rules. CLIENTS HAVE NO STORAGE POLICY:
-- they receive files exclusively via short-lived signed URLs minted by server
-- actions AFTER a files.visible_to_client check (spec §4). Do not add a client
-- storage.objects policy — signed URLs are the only client download path.
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

-- (no client policy: clients download only through server-minted signed URLs)
