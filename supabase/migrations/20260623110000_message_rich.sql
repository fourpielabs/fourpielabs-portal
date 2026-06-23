-- 20260623110000_message_rich.sql
-- Track 5 S1 — rich (TipTap) message content, stored WITHOUT corrupting history.
--   * messages.body stays the human TEXT (markdown for old rows; plaintext for new rich
--     rows) — so search (ILIKE body), notifications, and snippets keep working unchanged.
--   * messages.body_rich (NULLABLE) holds the TipTap HTML for NEW messages. NULL = render
--     the legacy markdown `body` via <Markdown>; non-null = render the sanitized rich HTML.
--   * NO existing row is touched → body_rich defaults NULL → every old message still renders
--     exactly as before. Additive + non-destructive. RLS unchanged (column inherits the
--     messages policies). The write path stays the SECURITY DEFINER RPCs (no client write).

alter table public.messages add column if not exists body_rich text;

-- ---- post_message: + p_body_rich (defaulted → existing 2/4-arg callers unbroken) --------
drop function if exists public.post_message(uuid, text, text, text);
create function public.post_message(
  p_thread_id uuid,
  p_body text,
  p_attachment_path text default null,
  p_attachment_name text default null,
  p_body_rich text default null
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
                               attachment_path, attachment_name, body_rich)
  values (p_thread_id, v_thread.client_id, v_thread.type, v_uid, btrim(p_body),
          nullif(btrim(p_attachment_path), ''), nullif(btrim(p_attachment_name), ''),
          nullif(btrim(p_body_rich), ''))
  returning * into v_row;

  update public.threads set updated_at = now() where id = p_thread_id;
  return v_row;
end;
$$;
revoke all on function public.post_message(uuid, text, text, text, text) from public, anon;
grant execute on function public.post_message(uuid, text, text, text, text) to authenticated;

-- ---- edit_message: + p_body_rich (preserve/replace the rich body on edit) ----------------
drop function if exists public.edit_message(uuid, text);
create function public.edit_message(p_message_id uuid, p_body text, p_body_rich text default null)
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
     set body = btrim(p_body), body_rich = nullif(btrim(p_body_rich), ''),
         edited_at = now(), updated_at = now()
   where id = p_message_id
  returning * into v_msg;
  return v_msg;
end;
$$;
revoke all on function public.edit_message(uuid, text, text) from public, anon;
grant execute on function public.edit_message(uuid, text, text) to authenticated;
