-- =============================================================================
-- Cal.com booking sync — backend (Part A).
--
-- Confirmed Cal.com bookings land in the portal via a signed BOOKING_* webhook
-- (app/api/cal/webhook) that upserts into call_bookings keyed on external_id
-- (the Cal.com booking uid) — idempotent against Cal.com's delivery retries.
-- The webhook writes via the SERVICE ROLE only; there is intentionally NO client
-- write policy here (the standing no-direct-client-write invariant — clients
-- only ever SELECT their own visible rows, exactly like call_recordings).
-- =============================================================================

-- booking lifecycle status
create type public.booking_status as enum ('booked', 'cancelled', 'rescheduled');

create table public.call_bookings (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  -- Cal.com booking uid — UNIQUE so the webhook upserts idempotently (onConflict).
  external_id       text unique,
  -- optional link to a configured call type (set null if that type is later removed)
  call_type_id      uuid references public.call_types (id) on delete set null,
  title             text,
  start_at          timestamptz,
  end_at            timestamptz,
  status            public.booking_status not null default 'booked',
  attendee_name     text,
  attendee_email    text,
  meeting_url       text,
  raw               jsonb,                 -- full webhook event, for debugging/audit
  visible_to_client boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_call_bookings_client_start on public.call_bookings (client_id, start_at);

alter table public.call_bookings enable row level security;

-- RLS mirrors call_recordings EXACTLY: admin all; assigned team all; client may
-- SELECT only its OWN client's VISIBLE rows. There is NO client/anon INSERT or
-- UPDATE policy — the webhook writes via the service role (which bypasses RLS),
-- so bookings are never client-writable.
create policy "call_bookings_admin_all" on public.call_bookings
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "call_bookings_team_all" on public.call_bookings
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "call_bookings_client_select" on public.call_bookings
  for select to authenticated
  using (client_id = app.my_client_id() and visible_to_client);

create trigger trg_call_bookings_updated_at
  before update on public.call_bookings
  for each row execute function public.set_updated_at();

-- A confirmed booking is a NEW notification event: the webhook fires notify() to
-- assigned staff + the client. Add 'call_booked' as a first-class notification
-- type, plus its per-user EMAIL opt-out column (the 4e pattern — one boolean per
-- type, DEFAULT TRUE = opt-out baked in; absence-of-row still sends).
--   NOTE: ALTER TYPE ... ADD VALUE is allowed inside this migration's transaction
--   because the new value is NOT used here (it's only written at runtime). The
--   webhook + notify() run in later, separate transactions.
alter type public.notification_type add value if not exists 'call_booked';

alter table public.notification_preferences
  add column if not exists email_call_booked boolean not null default true;
