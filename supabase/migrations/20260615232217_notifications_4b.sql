-- =============================================================================
-- 20260615232217_notifications_4b.sql
--
-- Phase 4b — Notifications (data layer). Per-USER rows: each recipient of an
-- event gets their OWN notification row, so read_at is per-user (a message to a
-- thread with 3 staff recipients = 3 rows).
--   * RLS: a user reads/updates ONLY their own rows (user_id = auth.uid()).
--   * NO insert policy — rows are inserted by service-role server actions on
--     real events (the audit_log precedent), never a client/user insert.
--   * NO delete policy (v1).
-- The internal-thread-never-notifies-client rule lives in the event-generation
-- code (lib/notifications.ts), derived from the real thread type — not here.
-- =============================================================================

create type public.notification_type as enum (
  'message',
  'deliverable_delivered',
  'deliverable_approved',
  'report_published',
  'project_status'
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.notification_type not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- read own only (user_id = auth.uid() — non-null for authenticated; NULL = deny)
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- mark own read (update own rows only; the action only sets read_at)
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- NO insert policy  → service-role server actions only (audit_log precedent).
-- NO delete policy  → v1.
