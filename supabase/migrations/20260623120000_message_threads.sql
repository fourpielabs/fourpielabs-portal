-- =============================================================================
-- 20260623120000_message_threads.sql  — Track 5 S2: threaded replies
--
-- A message can REPLY to another message via a nullable self-FK parent_message_id.
--   * parent_message_id NULL  = a top-level message → renders exactly as today
--     (existing rows are untouched; the column defaults NULL). Additive + non-
--     destructive. RLS UNCHANGED — a reply is just a message, so the existing
--     messages policies (admin all · team assigned · client own client_shared +
--     deleted_at is null) already scope it. No new policy, no client write path.
--
--   * ON DELETE SET NULL (the tasks.source_message_id precedent): a hard-deleted
--     parent leaves its replies as top-level rather than cascade-destroying them.
--     The app only ever SOFT-deletes (deleted_at), so this fires only on a true
--     row removal (e.g. thread/client cascade, which already removes the replies
--     too via thread_id/client_id) — SET NULL is the safe, no-data-loss choice.
--
-- THE BOUNDARY (this section's risk): a reply MUST inherit its parent's thread /
-- visibility and can NEVER cross from the client_shared thread into the internal
-- staff-only thread (or vice-versa). Enforcement is STRUCTURAL, not trust-based:
--   1. post_message already sources client_id + thread_type from v_thread (the
--      thread being posted to), NEVER from the parent or caller — so a reply's
--      denormalized RLS columns are always its real thread's.
--   2. The RPC additionally requires parent.thread_id = p_thread_id, so a reply
--      and its parent are ALWAYS in the same thread. A client posting to their
--      shared thread with an INTERNAL message's id as the parent is rejected
--      (thread mismatch); and a client cannot post to the internal thread at all
--      (can_access_thread denies). The parent is read inside the DEFINER body
--      (bypassing RLS) precisely so we can SEE an internal parent in order to
--      REJECT it — the client still never reads it.
-- =============================================================================

-- ---- column + index ---------------------------------------------------------
alter table public.messages
  add column if not exists parent_message_id uuid
  references public.messages (id) on delete set null;

-- replies are queried by their parent; partial index keeps it lean (most rows
-- are top-level / NULL).
create index if not exists idx_messages_parent
  on public.messages (parent_message_id)
  where parent_message_id is not null;

-- ---- post_message: + p_parent_message_id (defaulted → existing callers OK) ----
-- Faithful copy of the S1 (uuid,text,text,text,text) body + the parent validation.
drop function if exists public.post_message(uuid, text, text, text, text);
create function public.post_message(
  p_thread_id uuid,
  p_body text,
  p_attachment_path text default null,
  p_attachment_name text default null,
  p_body_rich text default null,
  p_parent_message_id uuid default null
)
returns public.messages
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_thread public.threads;
  v_parent public.messages;
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

  -- reply boundary: the parent (if any) MUST live in the SAME thread, so the reply
  -- inherits its parent's thread/visibility and can never cross into another thread.
  if p_parent_message_id is not null then
    select * into v_parent from public.messages where id = p_parent_message_id;
    if not found then raise exception 'Parent message not found'; end if;
    if v_parent.deleted_at is not null then raise exception 'Cannot reply to a deleted message'; end if;
    if v_parent.thread_id is distinct from p_thread_id then
      raise exception 'A reply must stay in the same thread as the message it replies to';
    end if;
  end if;

  insert into public.messages (thread_id, client_id, thread_type, author_id, body,
                               attachment_path, attachment_name, body_rich, parent_message_id)
  values (p_thread_id, v_thread.client_id, v_thread.type, v_uid, btrim(p_body),
          nullif(btrim(p_attachment_path), ''), nullif(btrim(p_attachment_name), ''),
          nullif(btrim(p_body_rich), ''), p_parent_message_id)
  returning * into v_row;

  update public.threads set updated_at = now() where id = p_thread_id;
  return v_row;
end;
$$;
revoke all on function public.post_message(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.post_message(uuid, text, text, text, text, uuid) to authenticated;
