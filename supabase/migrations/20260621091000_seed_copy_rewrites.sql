-- =============================================================================
-- 20260621091000_seed_copy_rewrites.sql  (P1 — approved copy)
--
-- COPY-ONLY: re-applies the approved content-audit rewrites to two onboarding
-- checklist titles seeded by seed_new_client():
--   * "Confirm your ICP & offer clarity" → "Confirm your ideal customer & offer"
--     (GENERIC — "ICP" is agency jargon for a local-service owner)
--   * "Automation setup"                  → "Set up your lead automation"
--     (TIGHTEN — says what it does)
--
-- Reproduces the canonical seed_new_client() (from 20260615181456) verbatim
-- EXCEPT those two strings. No behavior change. There are zero program clients
-- today, so this only affects future seeds (existing-client backfill not needed).
-- =============================================================================
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
    (new.id, 'onboarding', 'Phase 2 — Getting Set Up',  'Confirm your ideal customer & offer',   'client', 9,  true),
    (new.id, 'onboarding', 'Phase 2 — Getting Set Up',  'Share analytics & account access',      'client', 10, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'Attend your strategy call',             'client', 11, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'Approve your strategy doc',             'client', 12, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'Approve your first content calendar',   'client', 13, true),
    (new.id, 'onboarding', 'Phase 3 — First Call Done', 'Set up your lead automation',           'team',   14, true),
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
