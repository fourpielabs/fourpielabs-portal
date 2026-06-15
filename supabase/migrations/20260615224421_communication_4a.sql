-- =============================================================================
-- 20260615224421_communication_4a.sql
--
-- Phase 4a — Communication data layer (NO UI/bell/email; those are 4b–4d).
--   * threads (client_shared | internal) + messages (client_id + thread_type
--     denormalized for RLS) + thread_reads (unread tracking), all RLS-enabled.
--   * RLS shape mirrors existing tables: admin all · team is_assigned(client_id)
--     for BOTH thread types · client SELECT-only its OWN client_shared thread
--     (the internal thread is invisible to clients at the DB layer).
--   * Client write path = SECURITY DEFINER RPCs only (post_message,
--     mark_thread_read) — NO direct client INSERT/UPDATE policy on any table
--     (the standing invariant holds; precedent: set_deliverable_approval /
--     create_project).
--   * Seeding: one client_shared + one internal thread per client, for BOTH
--     program AND project clients (everyone communicates) — separate from the
--     program-only roadmap seed. Existing clients are backfilled.
-- =============================================================================

-- ---- O1: threads ------------------------------------------------------------
create type public.thread_type as enum ('client_shared', 'internal');

create table public.threads (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  type       public.thread_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_threads_client_type on public.threads (client_id, type);
create index idx_threads_client on public.threads (client_id);
create trigger trg_threads_updated_at
  before update on public.threads
  for each row execute function public.set_updated_at();

alter table public.threads enable row level security;
create policy "threads_admin_all" on public.threads
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "threads_team_all" on public.threads
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "threads_client_select" on public.threads
  for select to authenticated
  using (client_id = app.my_client_id() and type = 'client_shared');
-- internal thread is invisible to clients; no client write policy.

-- ---- O2: messages (client_id + thread_type denormalized for RLS) ------------
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.threads (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  thread_type public.thread_type not null,
  author_id   uuid references public.profiles (id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_messages_thread on public.messages (thread_id, created_at);
create index idx_messages_client on public.messages (client_id);

alter table public.messages enable row level security;
create policy "messages_admin_all" on public.messages
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "messages_team_all" on public.messages
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "messages_client_select" on public.messages
  for select to authenticated
  using (client_id = app.my_client_id() and thread_type = 'client_shared');
-- NO client INSERT/UPDATE/DELETE policy — clients post only via post_message().

-- ---- O3: thread_reads (unread mechanism) ------------------------------------
create table public.thread_reads (
  thread_id    uuid not null references public.threads (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
alter table public.thread_reads enable row level security;
create policy "thread_reads_select_own" on public.thread_reads
  for select to authenticated using (user_id = (select auth.uid()));
-- writes via mark_thread_read() only (no direct INSERT/UPDATE policy). unread per
-- thread = exists(message.created_at > coalesce(last_read_at,'-infinity')) — 4b reads.

-- ---- O4: shared scope helper (private `app` schema) -------------------------
-- Used inside the two RPCs below. NOTE the grant: authenticated ONLY — an
-- unauthenticated (anon) user must never execute a definer thread-access helper;
-- service_role isn't granted either (the seed trigger runs as definer and never
-- calls this, and the RPCs that do are themselves DEFINER-owned).
create or replace function app.can_access_thread(p_client_id uuid, p_type public.thread_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_admin()
      or (app.is_team() and app.is_assigned(p_client_id))
      or (p_type = 'client_shared' and p_client_id = app.my_client_id());
$$;
revoke all on function app.can_access_thread(uuid, public.thread_type) from public, anon;
grant execute on function app.can_access_thread(uuid, public.thread_type) to authenticated;

-- ---- O5: client write RPCs (the ONLY post / mark-read paths) -----------------
create function public.post_message(p_thread_id uuid, p_body text)
returns public.messages
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_thread public.threads;
  v_row    public.messages;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'Message cannot be empty'; end if;
  select * into v_thread from public.threads where id = p_thread_id;
  if not found then raise exception 'Thread not found'; end if;
  -- scope: admin any · team assigned (both types) · client OWN client_shared only
  if not app.can_access_thread(v_thread.client_id, v_thread.type) then
    raise exception 'Not authorized for this thread';
  end if;

  insert into public.messages (thread_id, client_id, thread_type, author_id, body)
  values (p_thread_id, v_thread.client_id, v_thread.type, v_uid, btrim(p_body))
  returning * into v_row;

  update public.threads set updated_at = now() where id = p_thread_id;
  return v_row;
end;
$$;
revoke all on function public.post_message(uuid, text) from public, anon;
grant execute on function public.post_message(uuid, text) to authenticated;

create function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql security definer set search_path = ''
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

  insert into public.thread_reads (thread_id, user_id, last_read_at)
  values (p_thread_id, v_uid, now())
  on conflict (thread_id, user_id) do update set last_read_at = now();
end;
$$;
revoke all on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;

-- ---- O6: seeding (BOTH client types) + backfill -----------------------------
create or replace function public.seed_client_threads()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- both thread types for EVERY client (program AND project) — communication is
  -- universal, unlike the program-only roadmap seed in seed_new_client().
  insert into public.threads (client_id, type)
  values (new.id, 'client_shared'), (new.id, 'internal');
  return new;
end;
$$;
revoke all on function public.seed_client_threads() from public, anon, authenticated;
create trigger trg_seed_client_threads
  after insert on public.clients
  for each row execute function public.seed_client_threads();

-- backfill: every EXISTING client gets its two threads
insert into public.threads (client_id, type)
select c.id, t.type
from public.clients c
cross join (values ('client_shared'::public.thread_type), ('internal'::public.thread_type)) as t(type)
on conflict (client_id, type) do nothing;
