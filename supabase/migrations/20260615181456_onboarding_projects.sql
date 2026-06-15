-- =============================================================================
-- 20260615181456_onboarding_projects.sql
--
-- Onboarding + Projects data model:
--   * clients.client_type ('program' | 'project'), default 'program' so every
--     existing client keeps today's behavior (the 90-day roadmap).
--   * public.projects (RLS-scoped) + deliverables.project_id (nullable).
--   * client write path for projects via SECURITY DEFINER RPCs (create/update) —
--     NO direct client INSERT/UPDATE policy (invariant preserved).
--   * client_clients view gains client_type (client-safe; needed for the
--     dashboard branch).
--   * seed_new_client() is GATED to program clients only — a project client gets
--     NO checklist / roadmap / metric-definition rows (no orphan program data).
-- =============================================================================

-- ---- O1: client_type --------------------------------------------------------
create type public.client_type as enum ('program', 'project');

alter table public.clients
  add column client_type public.client_type not null default 'program';

-- ---- O2: projects -----------------------------------------------------------
create type public.project_status as enum ('proposed', 'active', 'in_review', 'complete');

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  title       text not null,
  description text,
  status      public.project_status not null default 'proposed',
  start_date  date,
  due_date    date,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_projects_client on public.projects (client_id);
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

create policy "projects_admin_all" on public.projects
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "projects_team_all" on public.projects
  for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "projects_client_select" on public.projects
  for select to authenticated using (client_id = app.my_client_id());
-- NO client INSERT/UPDATE policy — clients write only via the RPCs below.

-- ---- O3: deliverables.project_id (nullable; existing rows stay valid) --------
alter table public.deliverables
  add column project_id uuid references public.projects (id) on delete set null;
create index idx_deliverables_project on public.deliverables (project_id);

-- ---- O4: client write RPCs (own project, type-gated) ------------------------
create or replace function public.create_project(p_title text, p_description text)
returns public.projects
language plpgsql security definer set search_path = ''
as $$
declare
  v_client uuid := app.my_client_id();
  v_type   public.client_type;
  v_row    public.projects;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  if v_client is null then raise exception 'Only clients can add projects'; end if;
  select client_type into v_type from public.clients where id = v_client;
  if v_type is distinct from 'project' then
    raise exception 'Only project clients can add projects';
  end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'Title is required'; end if;

  insert into public.projects (client_id, title, description, status, created_by)
  values (v_client, btrim(p_title), nullif(btrim(p_description), ''), 'proposed', (select auth.uid()))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_project(
  p_id uuid,
  p_title text,
  p_description text,
  p_status public.project_status
)
returns public.projects
language plpgsql security definer set search_path = ''
as $$
declare
  v_client uuid := app.my_client_id();
  v_row    public.projects;
begin
  if v_client is null then raise exception 'Only clients can edit projects'; end if;
  select * into v_row from public.projects where id = p_id;
  if not found then raise exception 'Project not found'; end if;
  if v_row.client_id is distinct from v_client then
    raise exception 'Not authorized for this project';
  end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'Title is required'; end if;

  update public.projects
     set title = btrim(p_title),
         description = nullif(btrim(p_description), ''),
         status = p_status
   where id = p_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.create_project(text, text) from public, anon;
revoke all on function public.update_project(uuid, text, text, public.project_status) from public, anon;
grant execute on function public.create_project(text, text) to authenticated;
grant execute on function public.update_project(uuid, text, text, public.project_status) to authenticated;

-- ---- client_clients view: + client_type (client-safe) -----------------------
-- (recreate with the same explicit column list + client_type appended; still
--  excludes internal_notes and filters to the caller's own client row.)
create or replace view public.client_clients
with (security_invoker = off)
as
  select
    id, name, slug, industry, program, status, website_url, logo_url,
    start_date, end_date, service_type, investment, onboarding_form_url,
    welcome_doc_url, comms_channel, primary_contact_user_id,
    whats_included, whats_not_included, best_way_to_reach, response_time,
    call_scheduling_note, revision_policy, created_at, updated_at,
    client_type
  from public.clients
  where id = app.my_client_id();
revoke all on public.client_clients from anon;
grant select on public.client_clients to authenticated;

-- ---- seed gating: program clients seed as today; project clients seed NONE ---
create or replace function public.seed_new_client()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Project clients use the projects board, not the program roadmap — seeding
  -- checklist/roadmap/metrics for them would be orphan data that never renders.
  if new.client_type is distinct from 'program' then
    return new;
  end if;

  -- ---- onboarding checklist (visible to client) -----------------------------
  insert into public.checklist_items
    (client_id, kind, phase_label, title, assignee, sort_order, visible_to_client)
  values
    (new.id, 'onboarding', 'Phase 1 — Before We Start', 'Sign your service agreement',          'client', 1,  true),
    (new.id, 'onboarding', 'Phase 1 — Before We Start', 'Make your first payment',               'client', 2,  true),
    (new.id, 'onboarding', 'Phase 1 — Before We Start', 'Complete the onboarding form',          'client', 3,  true),
    (new.id, 'onboarding', 'Phase 1 — Before We Start', 'Read your welcome doc',                 'client', 4,  true),
    (new.id, 'onboarding', 'Phase 1 — Before We Start', 'Bookmark your client portal',           'client', 5,  true),
    (new.id, 'onboarding', 'Phase 2 — Getting Set Up',  'Book your strategy call',               'client', 6,  true),
    (new.id, 'onboarding', 'Phase 2 — Getting Set Up',  'Join the communication channel',        'client', 7,  true),
    (new.id, 'onboarding', 'Phase 2 — Getting Set Up',  'Send over your brand assets',           'client', 8,  true),
    (new.id, 'onboarding', 'Phase 2 — Getting Set Up',  'Confirm your ICP & offer clarity',      'client', 9,  true),
    (new.id, 'onboarding', 'Phase 2 — Getting Set Up',  'Share analytics & account access',      'client', 10, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'Attend your strategy call',             'client', 11, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'Approve your strategy doc',             'client', 12, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'Approve your first content calendar',   'client', 13, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'Automation setup',                      'team',   14, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'First content live',                    'team',   15, true);

  -- ---- off-boarding checklist (team-only, hidden from client) ----------------
  insert into public.checklist_items
    (client_id, kind, phase_label, title, assignee, sort_order, visible_to_client)
  values
    (new.id, 'offboarding', 'Off-boarding', 'Final deliverables sent',       'team', 1,  false),
    (new.id, 'offboarding', 'Off-boarding', 'Final report delivered',        'team', 2,  false),
    (new.id, 'offboarding', 'Off-boarding', 'Assets shared',                 'team', 3,  false),
    (new.id, 'offboarding', 'Off-boarding', 'Final call done',               'team', 4,  false),
    (new.id, 'offboarding', 'Off-boarding', 'Recording shared',              'team', 5,  false),
    (new.id, 'offboarding', 'Off-boarding', 'Testimonial requested',         'team', 6,  false),
    (new.id, 'offboarding', 'Off-boarding', 'Referral conversation',         'team', 7,  false),
    (new.id, 'offboarding', 'Off-boarding', 'Renewal decision recorded',     'team', 8,  false),
    (new.id, 'offboarding', 'Off-boarding', 'Final message sent',            'team', 9,  false),
    (new.id, 'offboarding', 'Off-boarding', 'Portal access updated',         'team', 10, false);

  -- ---- default 90-day roadmap (visible to client) ----------------------------
  insert into public.milestones
    (client_id, title, description, phase_label, status, sort_order, visible_to_client)
  values
    (new.id, 'Discovery & Audit',          'Deep-dive on your business, market, and current presence.',        'Week 1',     'upcoming', 1, true),
    (new.id, 'Foundation Build',           'Set up the core systems, tracking, and assets.',                   'Week 2',     'upcoming', 2, true),
    (new.id, 'AEO + Content Engine',       'Launch the answer-engine optimization and content production.',    'Weeks 3–4',  'upcoming', 3, true),
    (new.id, 'Ads Launch + Optimization',  'Stand up paid campaigns and optimize toward cost per lead.',       'Weeks 5–8',  'upcoming', 4, true),
    (new.id, 'Scale & Compound',           'Double down on what works and compound the results.',              'Weeks 9–12', 'upcoming', 5, true);

  -- ---- program-specific metric definitions -----------------------------------
  if new.program = 'pulse' then
    insert into public.metric_definitions (client_id, key, label, unit, sort_order) values
      (new.id, 'total_views',           'Total Views',          'number',   1),
      (new.id, 'follower_count',         'Follower Count',       'number',   2),
      (new.id, 'follower_growth',        'Follower Growth',      'number',   3),
      (new.id, 'profile_visits',         'Profile Visits',       'number',   4),
      (new.id, 'inbound_dms',            'Inbound DMs',          'number',   5),
      (new.id, 'sales_calls_booked',     'Sales Calls Booked',   'number',   6),
      (new.id, 'new_clients_closed',     'New Clients Closed',   'number',   7),
      (new.id, 'revenue_this_month',     'Revenue This Month',   'currency', 8),
      (new.id, 'best_performing_post',   'Best Performing Post', 'text',     9),
      (new.id, 'hook_that_worked_best',  'Hook That Worked Best','text',     10),
      (new.id, 'key_learning',           'Key Learning',         'text',     11);
  else
    insert into public.metric_definitions (client_id, key, label, unit, sort_order) values
      (new.id, 'leads',             'Leads',            'number',   1),
      (new.id, 'gbp_calls',         'GBP Calls',        'number',   2),
      (new.id, 'top3_keywords',     'Top-3 Keywords',   'number',   3),
      (new.id, 'map_pack_keywords', 'Map-Pack Keywords','number',   4),
      (new.id, 'aeo_citations',     'AEO Citations',    'number',   5),
      (new.id, 'organic_traffic',   'Organic Traffic',  'number',   6),
      (new.id, 'ad_spend',          'Ad Spend',         'currency', 7),
      (new.id, 'ad_conversions',    'Ad Conversions',   'number',   8),
      (new.id, 'cost_per_lead',     'Cost per Lead',    'currency', 9),
      (new.id, 'key_learning',      'Key Learning',     'text',     10);
  end if;

  return new;
end;
$$;
