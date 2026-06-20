-- =============================================================================
-- PROPOSED MIGRATION (P0) — Program Catalog. NOT APPLIED.
--
-- Intentionally lives in docs/program/, NOT supabase/migrations/, so `supabase db
-- push` can never pick it up. This is a review artifact. On owner approval it
-- becomes a timestamped file in supabase/migrations/ (that's P1, not P0).
--
-- Properties: ADDITIVE + NON-DESTRUCTIVE. New tables, one new
-- nullable-defaulted column (metric_definitions.source), catalog seed, and an
-- idempotent backfill of client_programs from clients.program. No drops, no
-- type changes, no behavior change. clients.program stays as-is.
--
-- Invariants preserved: no client write path on any new table (catalog =
-- read-only to clients; client_programs = staff-only write, client SELECT-own).
-- =============================================================================

-- ---- C1: programs (the 4-program catalog) -----------------------------------
create table public.programs (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,          -- matches program_tier enum values
  name         text not null,
  tagline      text,
  tier_order   int,                            -- core stack rank; NULL for parallel (Pulse)
  is_parallel  boolean not null default false, -- true = Pulse (additive, not a core tier)
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_programs_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

-- ---- C2: program_services (each program's OWN additions; stack resolves later)
create table public.program_services (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs (id) on delete cascade,
  label       text not null,
  description text,
  category    text not null,                  -- seo|gbp|content|aeo|ads|ai|crm|social|strategy|exclusivity
  sort_order  int not null default 0,
  is_active   boolean not null default true
);
create index idx_program_services_program on public.program_services (program_id);

-- ---- C3: program_kpis (KPI DEFINITIONS per program; integration-ready) -------
create table public.program_kpis (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs (id) on delete cascade,
  key         text not null,                  -- reused as metric_definitions.key
  label       text not null,
  unit        public.metric_unit not null default 'number',
  source      text not null default 'manual', -- integration key: manual|gsc|gbp|google_ads|meta_ads|ga4
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  unique (program_id, key)
);
create index idx_program_kpis_program on public.program_kpis (program_id);

-- ---- C4: client_programs (assignment link; staff-only write) -----------------
create table public.client_programs (
  client_id   uuid not null references public.clients (id) on delete cascade,
  program_id  uuid not null references public.programs (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (client_id, program_id)
);
create index idx_client_programs_client on public.client_programs (client_id);

-- at most ONE core tier per client (core tiers are mutually exclusive; Pulse is
-- additive). Partial unique on the *non-parallel* assignment, keyed by a
-- denormalized flag kept in sync by a trigger (a partial unique can't reach
-- through the FK to programs.is_parallel directly).
alter table public.client_programs add column is_parallel boolean not null default false;
create unique index uq_client_one_core_tier
  on public.client_programs (client_id) where (is_parallel = false);

create or replace function public.sync_client_program_parallel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select p.is_parallel into new.is_parallel from public.programs p where p.id = new.program_id;
  return new;
end;
$$;
create trigger trg_client_programs_parallel
  before insert or update of program_id on public.client_programs
  for each row execute function public.sync_client_program_parallel();

-- ---- C5: metric_definitions.source (make the existing manual grid integration-ready)
alter table public.metric_definitions
  add column source text not null default 'manual';

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.programs         enable row level security;
alter table public.program_services enable row level security;
alter table public.program_kpis     enable row level security;
alter table public.client_programs  enable row level security;

-- Catalog: readable by ALL authenticated roles (it's the public service menu);
-- admin curates. (Service catalog has no client data → safe to expose labels.)
create policy "programs_read"  on public.programs         for select to authenticated using (true);
create policy "programs_admin" on public.programs         for all    to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "psvc_read"      on public.program_services for select to authenticated using (true);
create policy "psvc_admin"     on public.program_services for all    to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "pkpi_read"      on public.program_kpis     for select to authenticated using (true);
create policy "pkpi_admin"     on public.program_kpis     for all    to authenticated using (app.is_admin()) with check (app.is_admin());

-- client_programs: STAFF-ONLY WRITE (the project/task-status lock). Client reads
-- own assignment; NO client INSERT/UPDATE/DELETE policy → no client write path.
create policy "cprog_admin_all"   on public.client_programs for all    to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "cprog_team_all"    on public.client_programs for all    to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "cprog_client_read" on public.client_programs for select to authenticated using (client_id = app.my_client_id());

-- =============================================================================
-- Resolution helpers (stacking + Pulse-parallel)
-- =============================================================================
-- the assigned core tier's rank for a client (NULL = no core tier / Pulse-only)
create or replace function app.client_core_tier_order(p_client uuid)
returns int language sql stable security definer set search_path = '' as $$
  select max(p.tier_order)
  from public.client_programs cp
  join public.programs p on p.id = cp.program_id
  where cp.client_id = p_client and p.is_parallel = false;
$$;

create or replace function app.client_has_pulse(p_client uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(bool_or(p.is_parallel), false)
  from public.client_programs cp
  join public.programs p on p.id = cp.program_id
  where cp.client_id = p_client;
$$;

-- resolved included services for a client (core stack UNION Pulse if assigned)
create or replace view public.client_included_services
with (security_invoker = on) as
  select s.*, p.key as program_key, p.name as program_name
  from public.client_programs cp
  join public.programs p on p.id = cp.program_id
  join public.program_services s on s.program_id = p.id
  where s.is_active
    and (
      (p.is_parallel = false and p.tier_order <= app.client_core_tier_order(cp.client_id))
      or p.is_parallel = true
    )
    and cp.client_id = cp.client_id;  -- RLS on client_programs scopes the caller's rows

-- resolved KPI set for a client (same union over program_kpis)
create or replace view public.client_program_kpis
with (security_invoker = on) as
  select k.*, p.key as program_key
  from public.client_programs cp
  join public.programs p on p.id = cp.program_id
  join public.program_kpis k on k.program_id = p.id
  where k.is_active
    and (
      (p.is_parallel = false and p.tier_order <= app.client_core_tier_order(cp.client_id))
      or p.is_parallel = true
    );

revoke all on public.client_included_services from anon;
revoke all on public.client_program_kpis from anon;
grant select on public.client_included_services to authenticated;
grant select on public.client_program_kpis to authenticated;

-- =============================================================================
-- SEED — the 4 programs + services + KPIs (owner copy may be tuned later)
-- =============================================================================
insert into public.programs (key, name, tagline, tier_order, is_parallel) values
  ('foundation',       'Foundation',       'Get found first — local + technical SEO, GBP, and AEO.',             1,   false),
  ('pipeline',         'Pipeline',         'Turn visibility into booked work — ads, landing pages, lead routing.', 2, false),
  ('operating_system', 'Operating System', 'Your growth on autopilot — multi-channel, AI, and CRM automation.', 3,   false),
  ('pulse',            'Pulse',            'Attention that compounds — social ads, creative, and community.',    null, true);

-- helper to fetch a program id by key inside this script
-- (services)
insert into public.program_services (program_id, label, description, category, sort_order)
select id, v.label, v.description, v.category, v.sort_order from public.programs, (values
  -- Foundation (Core)
  ('foundation','Local & technical SEO','Rank in the map pack and organic results for the searches that matter.','seo',1),
  ('foundation','Google Business Profile & reviews','Managed GBP, posts, and a steady flow of new reviews.','gbp',2),
  ('foundation','Monthly content','Answer-engine-ready content published every month.','content',3),
  ('foundation','Answer Engine Optimization (AEO)','Be the cited answer on Google AI, ChatGPT, and Maps.','aeo',4),
  ('foundation','Website conversion / rebuild','A fast, trust-building site that turns visits into calls.','seo',5),
  ('foundation','Market exclusivity','We work with one business per service area — your competitors can''t hire us.','exclusivity',6),
  -- Pipeline (Growth Engine) — adds
  ('pipeline','Google Ads (Search + Maps)','Paid placement above the fold while SEO compounds underneath.','ads',1),
  ('pipeline','Per-campaign landing pages','Dedicated pages built to convert each ad''s traffic.','ads',2),
  ('pipeline','AI lead scoring & routing','Every lead scored and routed so the best ones reach you first.','ai',3),
  ('pipeline','Call tracking','Every call captured and attributed to the campaign that earned it.','ads',4),
  ('pipeline','Weekly reviews','A weekly check-in on spend, leads, and cost per lead.','strategy',5),
  -- Operating System (Full Stack) — adds
  ('operating_system','Multi-channel ads','Google, Meta, and beyond — wherever your customers are.','ads',1),
  ('operating_system','Custom AI agent','An AI agent trained on your business to handle inbound 24/7.','ai',2),
  ('operating_system','CRM automation','Follow-up, nurture, and pipeline stages automated end to end.','crm',3),
  ('operating_system','Performance dashboard','One live dashboard across every channel and metric.','strategy',4),
  ('operating_system','Quarterly strategy','Quarterly planning to compound results across the year.','strategy',5),
  -- Pulse (Social First) — parallel
  ('pulse','Meta + YouTube/TikTok ads','Paid social that puts your offer in front of the right feed.','social',1),
  ('pulse','Creative production','Scroll-stopping video and creative produced for you.','social',2),
  ('pulse','Community & DM management','Comments and DMs handled so no lead goes cold.','social',3),
  ('pulse','Monthly creative refresh','Fresh hooks and creative every month to beat fatigue.','social',4),
  ('pulse','Weekly reviews','A weekly read on reach, engagement, and booked calls.','strategy',5)
) as v(prog_key,label,description,category,sort_order)
where public.programs.key = v.prog_key;

-- (KPIs — see docs/program/kpi-sets.md for the full rationale; sources are
--  integration keys, all entered MANUALLY today)
insert into public.program_kpis (program_id, key, label, unit, source, sort_order)
select id, v.key, v.label, v.unit::public.metric_unit, v.source, v.sort_order
from public.programs, (values
  -- Foundation (Core) — local/SEO/AEO, NO ad metrics
  ('foundation','leads','Leads','number','manual',1),
  ('foundation','gbp_calls','GBP Calls','number','gbp',2),
  ('foundation','top3_keywords','Top-3 Keywords','number','gsc',3),
  ('foundation','map_pack_keywords','Map-Pack Keywords','number','gbp',4),
  ('foundation','aeo_citations','AEO Citations','number','manual',5),
  ('foundation','organic_traffic','Organic Traffic','number','ga4',6),
  ('foundation','key_learning','Key Learning','text','manual',7),
  -- Pipeline (Growth Engine) — adds paid-search KPIs
  ('pipeline','ad_spend','Ad Spend','currency','google_ads',1),
  ('pipeline','ad_conversions','Ad Conversions','number','google_ads',2),
  ('pipeline','cost_per_lead','Cost per Lead','currency','manual',3),
  ('pipeline','calls_tracked','Calls Tracked','number','manual',4),
  -- Operating System (Full Stack) — adds multi-channel + blended
  ('operating_system','blended_cost_per_lead','Blended Cost per Lead','currency','manual',1),
  ('operating_system','pipeline_value','Pipeline Value','currency','manual',2),
  ('operating_system','revenue_attributed','Revenue Attributed','currency','manual',3),
  -- Pulse (Social First) — the social set
  ('pulse','total_views','Total Views','number','meta_ads',1),
  ('pulse','follower_count','Follower Count','number','meta_ads',2),
  ('pulse','follower_growth','Follower Growth','number','meta_ads',3),
  ('pulse','profile_visits','Profile Visits','number','meta_ads',4),
  ('pulse','inbound_dms','Inbound DMs','number','manual',5),
  ('pulse','sales_calls_booked','Sales Calls Booked','number','manual',6),
  ('pulse','new_clients_closed','New Clients Closed','number','manual',7),
  ('pulse','revenue_this_month','Revenue This Month','currency','manual',8),
  ('pulse','best_performing_post','Best Performing Post','text','manual',9),
  ('pulse','hook_that_worked_best','Hook That Worked Best','text','manual',10),
  ('pulse','key_learning','Key Learning','text','manual',11)
) as v(prog_key,key,label,unit,source,sort_order)
where public.programs.key = v.prog_key;

-- =============================================================================
-- BACKFILL — represent every existing program client in client_programs.
-- Idempotent: re-runnable. Maps clients.program (single value) → one assignment.
-- pulse → a Pulse row (parallel, no core tier), matching today's meaning.
-- =============================================================================
insert into public.client_programs (client_id, program_id)
select c.id, p.id
from public.clients c
join public.programs p on p.key = c.program::text
where c.client_type = 'program'
on conflict (client_id, program_id) do nothing;

-- NOTE (cutover, NOT done here): reads still come from clients.program. A later
-- phase flips Program tab / KPI seed / what's-included to resolve from
-- client_programs + the views above. clients.program stays until then.
