-- =============================================================================
-- 20260616144138_messaging_attachments_5d.sql — Phase 5d: message file attachments
-- Add an optional single attachment to a message. NO new bucket, NO new storage
-- policy (clients still have none — the standing rule): the file lives in the
-- existing private `client-files` bucket at {client_id}/{uuid}-{name}; access is
-- enforced on READ by a server action that first reads the message through the
-- USER (RLS) client, then mints a signed URL via the service role. So a client can
-- never reach an INTERNAL-thread attachment (messages_client_select is shared-only).
--
-- The columns inherit the message row's RLS unchanged → test:rls stays 185 (the
-- existing "client cannot read internal-thread messages" check already covers the
-- new columns; a focused assertion is added in the suite).
-- =============================================================================

alter table public.messages add column attachment_path text;
alter table public.messages add column attachment_name text;

-- Extend post_message to accept + store an attachment. Drop the 2-arg signature and
-- recreate as (uuid, text, text, text) with the new params defaulting null, so the
-- existing 2-arg callers (postMessageAction) still resolve via the defaults. The RPC
-- stores the path verbatim — access is enforced on the READ side, not here. Body OR
-- an attachment is now required (an attachment-only message is allowed).
drop function if exists public.post_message(uuid, text);

create function public.post_message(
  p_thread_id uuid,
  p_body text,
  p_attachment_path text default null,
  p_attachment_name text default null
)
returns public.messages
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_thread public.threads;
  v_row    public.messages;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(btrim(p_body), '') = '' and coalesce(btrim(p_attachment_path), '') = '' then
    raise exception 'Message cannot be empty';
  end if;
  select * into v_thread from public.threads where id = p_thread_id;
  if not found then raise exception 'Thread not found'; end if;
  -- scope: admin any · team assigned (both types) · client OWN client_shared only
  if not app.can_access_thread(v_thread.client_id, v_thread.type) then
    raise exception 'Not authorized for this thread';
  end if;

  insert into public.messages (thread_id, client_id, thread_type, author_id, body,
                               attachment_path, attachment_name)
  values (p_thread_id, v_thread.client_id, v_thread.type, v_uid, btrim(p_body),
          nullif(btrim(p_attachment_path), ''), nullif(btrim(p_attachment_name), ''))
  returning * into v_row;

  update public.threads set updated_at = now() where id = p_thread_id;
  return v_row;
end;
$$;
revoke all on function public.post_message(uuid, text, text, text) from public, anon;
grant execute on function public.post_message(uuid, text, text, text) to authenticated;
