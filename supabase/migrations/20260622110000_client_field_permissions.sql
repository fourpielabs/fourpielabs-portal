-- 20260622110000_client_field_permissions.sql
-- 3c — a DENY-BY-DEFAULT allowlist letting an admin grant a CLIENT permission to edit a
-- SHORT, CURATED set of SAFE fields on their OWN client record. NOT a matrix, NOT an
-- override. The invariant-carrying fields are neither columns here nor settable by the RPC,
-- so the floor (RLS + the RPC's hardcoded settable set) holds regardless of any permission.
-- Additive + non-destructive.

create table if not exists public.client_field_permissions (
  client_id              uuid primary key references public.clients (id) on delete cascade,
  can_edit_website_url   boolean not null default false,
  can_edit_comms_channel boolean not null default false,
  updated_at             timestamptz not null default now()
);
alter table public.client_field_permissions enable row level security;

-- admin manages; team (assigned) + client (own) may READ to render the right controls.
-- NO client/team WRITE policy → only an admin can grant; absence of a row = all-denied.
create policy "cfp_admin_all" on public.client_field_permissions
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy "cfp_team_select" on public.client_field_permissions
  for select to authenticated
  using (coalesce(app.is_assigned(client_id), false));
create policy "cfp_client_select_own" on public.client_field_permissions
  for select to authenticated
  using (coalesce(client_id = app.my_client_id(), false));

-- The ONLY client write path to the curated safe fields. SECURITY DEFINER; checks the
-- per-client grant (deny-by-default) and updates EXACTLY ONE safe column on the caller's
-- OWN client. The settable set is a hardcoded per-field UPDATE — locked columns
-- (status/program/internal_notes/name/...) are UNREACHABLE by construction, so no
-- permission value can ever escalate to one.
create or replace function public.client_update_profile_field(p_field text, p_value text)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  cid uuid := app.my_client_id();
  allowed boolean := false;
  v text := nullif(btrim(p_value), '');
begin
  if cid is null then
    raise exception 'Not a client';
  end if;

  -- 1) p_field MUST be in the hardcoded safe allowlist (else it cannot be addressed at all)
  -- 2) deny-by-default: the per-client grant for THIS field must be explicitly true
  if p_field = 'website_url' then
    select coalesce(can_edit_website_url, false) into allowed
      from public.client_field_permissions where client_id = cid;
  elsif p_field = 'comms_channel' then
    select coalesce(can_edit_comms_channel, false) into allowed
      from public.client_field_permissions where client_id = cid;
  else
    raise exception 'Field % is not client-editable', p_field;
  end if;

  if not coalesce(allowed, false) then
    raise exception 'Not permitted to edit %', p_field;
  end if;

  -- settable set is hardcoded per field — no dynamic SQL, locked columns never reachable
  if p_field = 'website_url' then
    update public.clients set website_url = v where id = cid;
  elsif p_field = 'comms_channel' then
    update public.clients set comms_channel = v where id = cid;
  end if;
end;
$$;

revoke all on function public.client_update_profile_field(text, text) from public, anon;
grant execute on function public.client_update_profile_field(text, text) to authenticated;
