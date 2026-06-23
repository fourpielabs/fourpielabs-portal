-- =============================================================================
-- 20260623150000_typing_and_read_receipts.sql  — Track 5 S4: typing + read receipts
--
-- THE REALTIME-DANGEROUS SECTION. Typing/seen are LIVE signals; a client must NEVER
-- receive ANY signal about the staff-only INTERNAL thread (not a typing indicator, not a
-- seen state, not the mere existence of internal activity).
--
-- TRANSPORT DECISION (researched — see docs/features/messages/s4/README.md): we do NOT
-- use Realtime PRESENCE or BROADCAST. Those are peer fan-out keyed only on the channel
-- TOPIC STRING and do NOT enforce table RLS — any subscriber on a topic receives every
-- event on it. Making them safe would require flipping the whole project to
-- private-channels-only + authoring realtime.messages topic-RLS (a new, differently-shaped
-- policy class — exactly where this app has historically been bitten by NULL/parse bugs).
-- Instead we route BOTH signals through RLS-FILTERED postgres_changes table events — the
-- SAME proven boundary the app already trusts for messages (4c). postgres_changes INSERT
-- and UPDATE events ARE RLS-filtered per-subscriber; DELETE is NOT (and isn't filterable),
-- so the boundary path uses INSERT/UPDATE ONLY:
--   * typing expires by TIMESTAMP (no DELETE — stale rows are simply ignored client-side);
--   * seen is an UPSERT on thread_reads (INSERT … ON CONFLICT DO UPDATE).
-- Both tables carry the denormalized client_id + thread_type (copied FROM the thread in the
-- SECURITY DEFINER RPC, never caller input) so their SELECT policies are pure-column mirrors
-- of messages_client_select. A client subscribing with filter thread_id=eq.<their shared
-- thread> can only ever pass their own shared id (the internal thread is invisible to them),
-- and even a crafted internal thread_id is RLS-filtered to zero rows → a client physically
-- cannot receive an internal typing/seen event.
-- =============================================================================

-- ============================ TYPING ========================================
create table public.typing_states (
  thread_id   uuid not null references public.threads (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,   -- denorm (thread): RLS
  thread_type public.thread_type not null,                                       -- denorm (thread): RLS
  updated_at  timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index idx_typing_states_thread on public.typing_states (thread_id);

alter table public.typing_states enable row level security;
create policy "typing_admin_select" on public.typing_states
  for select to authenticated using (app.is_admin());
create policy "typing_team_select" on public.typing_states
  for select to authenticated using (app.is_assigned(client_id));
create policy "typing_client_select" on public.typing_states
  for select to authenticated
  using (client_id = app.my_client_id() and thread_type = 'client_shared');
-- NO write policy for any role — set_typing() (definer) is the sole write path.

create function public.set_typing(p_thread_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_thread public.threads;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_thread from public.threads where id = p_thread_id;
  if not found then raise exception 'Thread not found'; end if;
  -- GATE from the thread row (never caller input): a client can't signal typing in internal.
  if not app.can_access_thread(v_thread.client_id, v_thread.type) then
    raise exception 'Not authorized for this thread';
  end if;
  insert into public.typing_states (thread_id, user_id, client_id, thread_type, updated_at)
  values (p_thread_id, v_uid, v_thread.client_id, v_thread.type, now())
  on conflict (thread_id, user_id) do update set updated_at = now();
end;
$$;
revoke all on function public.set_typing(uuid) from public, anon;
grant execute on function public.set_typing(uuid) to authenticated;

-- ============================ READ RECEIPTS =================================
-- thread_reads (4a) already holds the seen timestamp (last_read_at) written by
-- mark_thread_read. Make it deliverable to the OTHER party via postgres_changes:
--   (1) denormalize client_id + thread_type (mirror messages) — pure-column RLS;
--   (2) broaden SELECT so co-participants see each other's read rows, GATED like messages
--       (a client sees its own + staff's reads on the SHARED thread, never internal);
--   (3) set the denorm cols inside mark_thread_read; keep it the sole write path (upsert).
alter table public.thread_reads add column if not exists client_id   uuid references public.clients (id) on delete cascade;
alter table public.thread_reads add column if not exists thread_type public.thread_type;
-- backfill existing rows from their thread
update public.thread_reads tr
   set client_id = t.client_id, thread_type = t.type
  from public.threads t
 where tr.thread_id = t.id and (tr.client_id is null or tr.thread_type is null);
alter table public.thread_reads alter column client_id   set not null;
alter table public.thread_reads alter column thread_type set not null;
create index if not exists idx_thread_reads_thread on public.thread_reads (thread_id);

-- broaden read-visibility (additive policies; OR-combined with thread_reads_select_own).
create policy "thread_reads_admin_select" on public.thread_reads
  for select to authenticated using (app.is_admin());
create policy "thread_reads_team_select" on public.thread_reads
  for select to authenticated using (app.is_assigned(client_id));
create policy "thread_reads_client_select" on public.thread_reads
  for select to authenticated
  using (client_id = app.my_client_id() and thread_type = 'client_shared');
-- thread_reads_select_own (user_id = auth.uid()) stays — writes remain RPC-only.

-- mark_thread_read: now also stamps the denormalized boundary columns (from the thread).
create or replace function public.mark_thread_read(p_thread_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_thread public.threads;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_thread from public.threads where id = p_thread_id;
  if not found then raise exception 'Thread not found'; end if;
  if not app.can_access_thread(v_thread.client_id, v_thread.type) then
    raise exception 'Not authorized for this thread';
  end if;

  insert into public.thread_reads (thread_id, user_id, client_id, thread_type, last_read_at)
  values (p_thread_id, v_uid, v_thread.client_id, v_thread.type, now())
  on conflict (thread_id, user_id)
    do update set last_read_at = now(), client_id = excluded.client_id, thread_type = excluded.thread_type;
end;
$$;
revoke all on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;

-- ============================ REALTIME ======================================
-- Publish both tables. Subscribers consume INSERT/UPDATE only (the RLS-filtered events);
-- DELETE is never used on the boundary path (typing expires by timestamp; seen is upsert).
alter publication supabase_realtime add table public.typing_states;
alter publication supabase_realtime add table public.thread_reads;
