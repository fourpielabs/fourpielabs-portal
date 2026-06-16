-- =============================================================================
-- 20260616022443_notification_preferences_4e.sql
--
-- Phase 4e — per-user EMAIL notification preferences. One row per user, a boolean
-- column per notification type (the 5 types are a fixed enum). Every column
-- DEFAULTS TRUE, and a user with NO row is treated as all-on (opt-out default) by
-- the send logic + the settings UI — so a user who never opens Settings is fully
-- notified. Rows are created lazily on the user's first Save (insert_own policy).
--
-- Per-user personal state (the notifications mark-read / profiles self-update
-- precedent) — a direct self-policy, NOT a client-data write. RLS: select/insert/
-- update OWN only (`user_id = auth.uid()` — non-null for authenticated; NULL = deny
-- on both USING and WITH CHECK). Preferences gate the EMAIL channel only; the in-app
-- notification row always inserts regardless.
-- =============================================================================

create table public.notification_preferences (
  user_id                     uuid primary key references public.profiles (id) on delete cascade,
  email_message               boolean not null default true,
  email_deliverable_delivered boolean not null default true,
  email_deliverable_approved  boolean not null default true,
  email_report_published      boolean not null default true,
  email_project_status        boolean not null default true,
  updated_at                  timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notif_prefs_select_own" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notif_prefs_insert_own" on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "notif_prefs_update_own" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- no delete policy.

create trigger trg_notif_prefs_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();
