-- =============================================================================
-- 20260623130000_message_reactions.sql  — Track 5 S3: emoji reactions
--
-- A user can react to a message with an emoji. A reaction INHERITS its message's
-- visibility STRUCTURALLY (like an S2 reply): the boundary columns (client_id,
-- thread_type) are copied FROM THE MESSAGE inside the SECURITY DEFINER RPC — never
-- from caller input — so the reaction's RLS is a pure-column mirror of the message's.
-- Additive + non-destructive; existing messages unaffected.
--
-- TWO leaks, both closed structurally:
--   (1) WRITE — toggle_reaction re-reads the message's real thread_type/client_id and
--       gates on app.can_access_thread(...). A client reacting to an INTERNAL message
--       (even passing its id) is rejected; there is NO client write policy, so a direct
--       INSERT is denied (the post_message precedent — RPC is the sole write path).
--   (2) READ / EXISTENCE — the client SELECT policy is
--       (client_id = my_client_id() and thread_type = 'client_shared'), mirroring
--       messages_client_select. An internal reaction carries thread_type='internal' →
--       a client can never SELECT or COUNT it → the existence of an internal reaction
--       cannot leak the existence of an internal message.
--
-- REALTIME (the deliberate, researched design choice): message_reactions is NOT added
-- to supabase_realtime. Supabase does NOT RLS-filter DELETE events (the un-react case) —
-- per the docs, "RLS policies are not applied to DELETE statements ... the old record
-- contains only the primary key(s)" even with replica identity full. So subscribing a
-- client to reaction DELETE events could leak event existence regardless of policy.
-- Instead, toggle_reaction bumps the PARENT message's updated_at, which fires the
-- EXISTING messages UPDATE realtime event — and UPDATE events ARE RLS-filtered (the new
-- row carries client_id/thread_type). A reaction on an internal message bumps an
-- internal message → that UPDATE is RLS-denied to clients → a client receives NOTHING
-- (no event, no id, no existence leak). Subscribers refetch reactions via the RLS-scoped
-- action (never a raw payload). The boundary holds on the realtime path too.
-- =============================================================================

create table public.message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages (id) on delete cascade,
  thread_id   uuid not null references public.threads (id) on delete cascade,   -- denorm: thread-scoped reads
  client_id   uuid not null references public.clients (id) on delete cascade,   -- denorm (from message): RLS
  thread_type public.thread_type not null,                                       -- denorm (from message): RLS
  user_id     uuid not null references public.profiles (id) on delete cascade,
  emoji       text not null check (char_length(emoji) between 1 and 24),
  created_at  timestamptz not null default now(),
  unique (message_id, user_id, emoji)   -- a user can't double-react the same emoji
);
create index idx_message_reactions_message on public.message_reactions (message_id);
create index idx_message_reactions_thread on public.message_reactions (thread_id);
create index idx_message_reactions_client on public.message_reactions (client_id);

alter table public.message_reactions enable row level security;
-- READ: mirrors the messages SELECT policies exactly (pure-column on the denormalized
-- boundary cols). A reaction is visible iff its message's thread is visible to the caller.
create policy "reactions_admin_select" on public.message_reactions
  for select to authenticated using (app.is_admin());
create policy "reactions_team_select" on public.message_reactions
  for select to authenticated using (app.is_assigned(client_id));
create policy "reactions_client_select" on public.message_reactions
  for select to authenticated
  using (client_id = app.my_client_id() and thread_type = 'client_shared');
-- NO INSERT/UPDATE/DELETE policy for ANY role — every write goes through toggle_reaction()
-- (SECURITY DEFINER), so the boundary cannot be bypassed by a direct table write.

-- ---- toggle_reaction: the SOLE write path (add or remove the caller's emoji) ----------
create function public.toggle_reaction(p_message_id uuid, p_emoji text)
returns boolean   -- true = reaction ADDED, false = reaction REMOVED
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_msg   public.messages;
  v_emoji text := btrim(p_emoji);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_emoji = '' or char_length(v_emoji) > 24 then raise exception 'Invalid emoji'; end if;
  select * into v_msg from public.messages where id = p_message_id;
  if not found then raise exception 'Message not found'; end if;
  if v_msg.deleted_at is not null then raise exception 'Message was deleted'; end if;
  -- GATE: react only to a message whose thread the caller can access — derived from the
  -- message row, never the caller. A client reacting to an internal message → rejected.
  if not app.can_access_thread(v_msg.client_id, v_msg.thread_type) then
    raise exception 'Not authorized for this message';
  end if;

  -- toggle: remove the caller's same-emoji reaction if present, else add it.
  delete from public.message_reactions
   where message_id = p_message_id and user_id = v_uid and emoji = v_emoji;
  if found then
    -- bump the message so the EXISTING (RLS-safe) messages UPDATE realtime event fires;
    -- subscribers then refetch reactions via the RLS-scoped action.
    update public.messages set updated_at = now() where id = p_message_id;
    return false;
  end if;

  insert into public.message_reactions (message_id, thread_id, client_id, thread_type, user_id, emoji)
  values (p_message_id, v_msg.thread_id, v_msg.client_id, v_msg.thread_type, v_uid, v_emoji);
  update public.messages set updated_at = now() where id = p_message_id;
  return true;
end;
$$;
revoke all on function public.toggle_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_reaction(uuid, text) to authenticated;
