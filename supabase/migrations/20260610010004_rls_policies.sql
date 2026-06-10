-- =============================================================================
-- 20260610010004_rls_policies.sql
-- RLS policies for every table (spec §3, §4 "RLS pattern").
--
-- Standard pattern per client-scoped table:
--   * admin  -> ALL    using/check app.is_admin()
--   * team   -> ALL    using/check app.is_assigned(client_id)
--   * client -> SELECT using client_id = app.my_client_id() AND <visibility>
--
-- Clients have NO direct write policy anywhere. Their single write path is the
-- toggle_checklist_item() RPC (20260610010005). Table-level CRUD grants to the
-- anon/authenticated/service_role roles are provided automatically by Supabase
-- default privileges on the public schema; RLS below is what actually gates access.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- clients  (client role reads a SAFE VIEW, never the base table)
-- -----------------------------------------------------------------------------
create policy "clients_admin_all" on public.clients
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy "clients_team_all" on public.clients
  for all to authenticated
  using (app.is_assigned(id)) with check (app.is_assigned(id));
-- (no client policy on the base table => internal_notes is unreachable by clients)

-- Client-safe projection of clients: excludes internal_notes, filtered to the
-- caller's own client row. security_invoker = off deliberately bypasses the base
-- table RLS, and the WHERE clause + dropped column are what keep it safe.
-- Granted to authenticated only (anon has no my_client_id(), so it sees nothing).
--
-- !! EXPLICIT COLUMN LIST — NEVER `select *` HERE. This view bypasses RLS, so a
-- !! wildcard would silently leak any column added to clients later (e.g. a new
-- !! sensitive field like internal_notes). When you add a column to clients,
-- !! add it here ONLY if it is safe for the client role to read.
create view public.client_clients
with (security_invoker = off)
as
  select
    id, name, slug, industry, program, status, website_url, logo_url,
    start_date, end_date, service_type, investment, onboarding_form_url,
    welcome_doc_url, comms_channel, primary_contact_user_id,
    whats_included, whats_not_included, best_way_to_reach, response_time,
    call_scheduling_note, revision_policy, created_at, updated_at
  from public.clients
  where id = app.my_client_id();

revoke all on public.client_clients from anon;
grant select on public.client_clients to authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- team reads profiles connected to its assigned clients:
--   client-contact profiles of assigned clients, plus teammates assigned to them.
create policy "profiles_team_select" on public.profiles
  for select to authenticated
  using (
    app.is_team() and (
      (client_id is not null and app.is_assigned(client_id))
      or exists (
        select 1 from public.client_assignments ca
        where ca.user_id = public.profiles.id
          and app.is_assigned(ca.client_id)
      )
    )
  );

-- client reads their "Your Partner" through a NARROW definer view (below),
-- not the full profiles row. No client SELECT policy on profiles for the partner.

-- Guard: only an admin may change role / client_id / is_active. This backstops
-- the permissive profiles_update_own policy against privilege self-escalation.
create or replace function public.enforce_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Allow privileged server contexts: the service_role client (admin invites,
  -- assignments, deactivation, the seed script) connects with a null auth.uid(),
  -- which would otherwise fail app.is_admin() and block legitimate writes.
  if (select auth.role()) = 'service_role' then
    return new;
  end if;
  if app.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.client_id is distinct from old.client_id
     or new.is_active is distinct from old.is_active then
    raise exception 'Only an admin can change role, client_id, or is_active';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_self_update();

-- "Your Partner" definer view: a client reads ONLY their assigned client's
-- primary contact, and ONLY these four columns (no role/client_id/is_active,
-- no other team members). security_invoker = off bypasses profiles RLS, and the
-- WHERE clause restricts the result to exactly the caller's partner row.
-- !! EXPLICIT COLUMN LIST — NEVER `select *` HERE (would leak profiles columns).
create view public.client_partner
with (security_invoker = off)
as
  select p.id, p.full_name, p.avatar_url, p.email
  from public.profiles p
  where p.id = (
    select c.primary_contact_user_id
    from public.clients c
    where c.id = app.my_client_id()
  );

revoke all on public.client_partner from anon;
grant select on public.client_partner to authenticated;

-- -----------------------------------------------------------------------------
-- client_assignments  (admin all; team reads own rows)
-- -----------------------------------------------------------------------------
create policy "client_assignments_admin_all" on public.client_assignments
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy "client_assignments_team_select_own" on public.client_assignments
  for select to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- checklist_items  (client SELECT requires visible_to_client; writes via RPC only)
-- -----------------------------------------------------------------------------
create policy "checklist_items_admin_all" on public.checklist_items
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "checklist_items_team_all" on public.checklist_items
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "checklist_items_client_select" on public.checklist_items
  for select to authenticated
  using (client_id = app.my_client_id() and visible_to_client);

-- -----------------------------------------------------------------------------
-- milestones
-- -----------------------------------------------------------------------------
create policy "milestones_admin_all" on public.milestones
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "milestones_team_all" on public.milestones
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "milestones_client_select" on public.milestones
  for select to authenticated
  using (client_id = app.my_client_id() and visible_to_client);

-- -----------------------------------------------------------------------------
-- deliverables
-- -----------------------------------------------------------------------------
create policy "deliverables_admin_all" on public.deliverables
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "deliverables_team_all" on public.deliverables
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "deliverables_client_select" on public.deliverables
  for select to authenticated
  using (client_id = app.my_client_id() and visible_to_client);

-- -----------------------------------------------------------------------------
-- content_items
-- -----------------------------------------------------------------------------
create policy "content_items_admin_all" on public.content_items
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "content_items_team_all" on public.content_items
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "content_items_client_select" on public.content_items
  for select to authenticated
  using (client_id = app.my_client_id() and visible_to_client);

-- -----------------------------------------------------------------------------
-- metric_definitions  (client sees active definitions for their client)
-- -----------------------------------------------------------------------------
create policy "metric_definitions_admin_all" on public.metric_definitions
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "metric_definitions_team_all" on public.metric_definitions
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "metric_definitions_client_select" on public.metric_definitions
  for select to authenticated
  using (client_id = app.my_client_id() and is_active);

-- -----------------------------------------------------------------------------
-- metric_entries  (no visibility flag; scoped to the client)
-- -----------------------------------------------------------------------------
create policy "metric_entries_admin_all" on public.metric_entries
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "metric_entries_team_all" on public.metric_entries
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "metric_entries_client_select" on public.metric_entries
  for select to authenticated
  using (client_id = app.my_client_id());

-- -----------------------------------------------------------------------------
-- competitors
-- -----------------------------------------------------------------------------
create policy "competitors_admin_all" on public.competitors
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "competitors_team_all" on public.competitors
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "competitors_client_select" on public.competitors
  for select to authenticated
  using (client_id = app.my_client_id() and visible_to_client);

-- -----------------------------------------------------------------------------
-- call_types  (no visibility flag; scoped to the client)
-- -----------------------------------------------------------------------------
create policy "call_types_admin_all" on public.call_types
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "call_types_team_all" on public.call_types
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "call_types_client_select" on public.call_types
  for select to authenticated
  using (client_id = app.my_client_id());

-- -----------------------------------------------------------------------------
-- call_recordings
-- -----------------------------------------------------------------------------
create policy "call_recordings_admin_all" on public.call_recordings
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "call_recordings_team_all" on public.call_recordings
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "call_recordings_client_select" on public.call_recordings
  for select to authenticated
  using (client_id = app.my_client_id() and visible_to_client);

-- -----------------------------------------------------------------------------
-- meeting_notes
-- -----------------------------------------------------------------------------
create policy "meeting_notes_admin_all" on public.meeting_notes
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "meeting_notes_team_all" on public.meeting_notes
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "meeting_notes_client_select" on public.meeting_notes
  for select to authenticated
  using (client_id = app.my_client_id() and visible_to_client);

-- -----------------------------------------------------------------------------
-- reports  (client sees only PUBLISHED reports)
-- -----------------------------------------------------------------------------
create policy "reports_admin_all" on public.reports
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "reports_team_all" on public.reports
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "reports_client_select" on public.reports
  for select to authenticated
  using (client_id = app.my_client_id() and published);

-- -----------------------------------------------------------------------------
-- updates
-- -----------------------------------------------------------------------------
create policy "updates_admin_all" on public.updates
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "updates_team_all" on public.updates
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "updates_client_select" on public.updates
  for select to authenticated
  using (client_id = app.my_client_id() and visible_to_client);

-- -----------------------------------------------------------------------------
-- files  (client SELECT requires visible_to_client; downloads via signed URLs)
-- -----------------------------------------------------------------------------
create policy "files_admin_all" on public.files
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "files_team_all" on public.files
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "files_client_select" on public.files
  for select to authenticated
  using (client_id = app.my_client_id() and visible_to_client);

-- -----------------------------------------------------------------------------
-- invitations  (admin only)
-- -----------------------------------------------------------------------------
create policy "invitations_admin_all" on public.invitations
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- -----------------------------------------------------------------------------
-- audit_log  (admin-readable only; inserts come from service-role server actions)
-- -----------------------------------------------------------------------------
create policy "audit_log_admin_select" on public.audit_log
  for select to authenticated using (app.is_admin());
