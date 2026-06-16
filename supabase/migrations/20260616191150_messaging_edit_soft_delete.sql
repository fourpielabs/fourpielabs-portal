-- =============================================================================
-- 20260616191150_messaging_edit_soft_delete.sql  — Batch 2: chat edit + soft-delete
--
-- A user can EDIT and (soft-)DELETE their OWN message via SECURITY DEFINER RPCs
-- (no direct client write policy on messages — the post_message precedent). The
-- six-channel internal boundary holds: both RPCs require author_id = caller AND
-- app.can_access_thread(), so a client can never touch an internal-thread message
-- or another author's message.
--
-- Soft-delete: `deleted_at` is appended (`and deleted_at is null`) to the EXISTING
-- USING predicate of all three message SELECT paths — verbatim original + one AND,
-- so it can only NARROW (never widen) the scoping. Deleted messages then vanish
-- from every read (admin · team · client · realtime). WITH CHECK is left unchanged
-- (messages are only ever written through the DEFINER RPCs, which bypass RLS).
-- =============================================================================

alter table public.messages add column edited_at  timestamptz;
alter table public.messages add column deleted_at timestamptz;

-- hide soft-deleted messages from ALL reads (monotonic narrowing only)
alter policy "messages_admin_all" on public.messages
  using (app.is_admin() and deleted_at is null);
alter policy "messages_team_all" on public.messages
  using (app.is_assigned(client_id) and deleted_at is null);
alter policy "messages_client_select" on public.messages
  using (client_id = app.my_client_id() and thread_type = 'client_shared' and deleted_at is null);

-- ---- edit_message: author-only, thread re-checked ---------------------------
create or replace function public.edit_message(p_message_id uuid, p_body text)
returns public.messages
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_msg public.messages;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'Message cannot be empty'; end if;
  select * into v_msg from public.messages where id = p_message_id;
  if not found then raise exception 'Message not found'; end if;
  if v_msg.deleted_at is not null then raise exception 'Message was deleted'; end if;
  if v_msg.author_id is distinct from v_uid then
    raise exception 'You can only edit your own message';
  end if;
  if not app.can_access_thread(v_msg.client_id, v_msg.thread_type) then
    raise exception 'Not authorized for this thread';
  end if;

  update public.messages
     set body = btrim(p_body), edited_at = now(), updated_at = now()
   where id = p_message_id
  returning * into v_msg;
  return v_msg;
end;
$$;
revoke all on function public.edit_message(uuid, text) from public, anon;
grant execute on function public.edit_message(uuid, text) to authenticated;

-- ---- delete_message (soft): author-only, thread re-checked ------------------
create or replace function public.delete_message(p_message_id uuid)
returns public.messages
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_msg public.messages;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_msg from public.messages where id = p_message_id;
  if not found then raise exception 'Message not found'; end if;
  if v_msg.deleted_at is not null then return v_msg; end if; -- idempotent
  if v_msg.author_id is distinct from v_uid then
    raise exception 'You can only delete your own message';
  end if;
  if not app.can_access_thread(v_msg.client_id, v_msg.thread_type) then
    raise exception 'Not authorized for this thread';
  end if;

  update public.messages
     set deleted_at = now(), updated_at = now()
   where id = p_message_id
  returning * into v_msg;
  return v_msg;
end;
$$;
revoke all on function public.delete_message(uuid) from public, anon;
grant execute on function public.delete_message(uuid) to authenticated;
