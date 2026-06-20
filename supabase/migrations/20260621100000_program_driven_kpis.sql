-- =============================================================================
-- 20260621100000_program_driven_kpis.sql  (P2 — program-driven KPIs)
--
-- Closes the seam P1 flagged: the metrics grid read the flat per-client
-- seed_new_client set instead of the catalog. Now metric_definitions is the
-- PER-CLIENT MATERIALIZATION of the resolved program_kpis (stacked + Pulse),
-- kept in sync by a trigger on client_programs.
--
-- Connection to existing storage (documented):
--   program_kpis (catalog DEFINITIONS)  --sync-->  metric_definitions (per-client,
--   keyed by the stable KPI `key`)  <--FK--  metric_entries (the team's entered
--   numbers). The team still enters via the existing grid (metric_entries upsert
--   on (definition_id, period)). The KPI `source` flows catalog -> definition, so
--   a future Google Ads/Meta/GA4/GSC sync lands on the SAME metric_entries row.
--
-- Data preservation: out-of-program KPIs are DEACTIVATED (is_active=false), never
-- deleted — entered numbers are never orphaned, and re-including a tier restores
-- them with history intact. ADDITIVE + NON-DESTRUCTIVE; clients.program untouched.
--
-- Foundation-ad-columns defect (P0) is fixed here: Core resolves to its SEO/GBP/
-- AEO set only; ad KPIs exist on Pipeline+ — so Core never materializes ad
-- definitions, and the client RLS (metric_definitions_client_select requires
-- is_active) hides any that get deactivated.
-- =============================================================================

-- ---- the resolver, in SQL (mirrors lib/programs.ts stacking) -----------------
create or replace function public.sync_client_program_metrics(p_client uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  with assigned as (
    select p.id, p.tier_order, p.is_parallel
    from public.client_programs cp
    join public.programs p on p.id = cp.program_id
    where cp.client_id = p_client
  ),
  core_order as (
    select max(tier_order) as o from assigned where not is_parallel
  ),
  included as (
    -- core tiers up to the client's highest assigned tier, plus Pulse if assigned
    select pr.id, pr.tier_order
    from public.programs pr
    where pr.is_active and (
      (not pr.is_parallel and pr.tier_order <= (select o from core_order))
      or (pr.is_parallel and pr.id in (select id from assigned where is_parallel))
    )
  ),
  resolved as (
    -- dedupe by stable key (e.g. key_learning is in both the core stack and
    -- Pulse); keep the lowest ordinal so the grid orders sensibly
    select distinct on (k.key)
      k.key, k.label, k.unit, k.source,
      (coalesce(inc.tier_order, 99) * 100 + k.sort_order) as ord
    from public.program_kpis k
    join included inc on inc.id = k.program_id
    where k.is_active
    order by k.key, (coalesce(inc.tier_order, 99) * 100 + k.sort_order)
  ),
  upserted as (
    insert into public.metric_definitions (client_id, key, label, unit, source, sort_order, is_active)
    select p_client, r.key, r.label, r.unit, r.source, r.ord, true
    from resolved r
    on conflict (client_id, key) do update
      set label = excluded.label,
          unit = excluded.unit,
          source = excluded.source,
          sort_order = excluded.sort_order,
          is_active = true
    returning 1
  )
  -- deactivate (NEVER delete) definitions not in the resolved set
  update public.metric_definitions md
     set is_active = false
   where md.client_id = p_client
     and md.is_active
     and md.key not in (select key from resolved);
end;
$$;
revoke all on function public.sync_client_program_metrics(uuid) from public, anon, authenticated;

-- ---- keep metric_definitions in sync whenever the assignment changes ----------
create or replace function public.trg_client_programs_sync_metrics()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_client_program_metrics(old.client_id);
    return old;
  end if;
  perform public.sync_client_program_metrics(new.client_id);
  return new;
end;
$$;
create trigger trg_client_programs_metrics
  after insert or update or delete on public.client_programs
  for each row execute function public.trg_client_programs_sync_metrics();

-- ---- seed_new_client: program clients now get metrics from the CATALOG --------
-- (drop the flat metric block; checklist + roadmap unchanged. The mirror trigger
--  writes client_programs, which fires the metrics sync above — so a new program
--  client materializes exactly its program's KPI set.)
create or replace function public.seed_new_client()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.client_type is distinct from 'program' then
    return new;
  end if;

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
    (new.id, 'onboarding', 'Phase 2 — Getting Set Up',  'Confirm your ideal customer & offer',   'client', 9,  true),
    (new.id, 'onboarding', 'Phase 2 — Getting Set Up',  'Share analytics & account access',      'client', 10, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'Attend your strategy call',             'client', 11, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'Approve your strategy doc',             'client', 12, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'Approve your first content calendar',   'client', 13, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'Set up your lead automation',           'team',   14, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'First content live',                    'team',   15, true);

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

  insert into public.milestones
    (client_id, title, description, phase_label, status, sort_order, visible_to_client)
  values
    (new.id, 'Discovery & Audit',          'Deep-dive on your business, market, and current presence.',        'Week 1',     'upcoming', 1, true),
    (new.id, 'Foundation Build',           'Set up the core systems, tracking, and assets.',                   'Week 2',     'upcoming', 2, true),
    (new.id, 'AEO + Content Engine',       'Launch the answer-engine optimization and content production.',    'Weeks 3–4',  'upcoming', 3, true),
    (new.id, 'Ads Launch + Optimization',  'Stand up paid campaigns and optimize toward cost per lead.',       'Weeks 5–8',  'upcoming', 4, true),
    (new.id, 'Scale & Compound',           'Double down on what works and compound the results.',              'Weeks 9–12', 'upcoming', 5, true);

  -- metric_definitions are now materialized from the catalog by
  -- trg_client_programs_metrics (fired when the mirror trigger writes
  -- client_programs) — no flat seed here.
  return new;
end;
$$;

-- ---- backfill: materialize the catalog KPI set for existing program clients ---
do $$
declare r record;
begin
  for r in select id from public.clients where client_type = 'program' loop
    perform public.sync_client_program_metrics(r.id);
  end loop;
end;
$$;
