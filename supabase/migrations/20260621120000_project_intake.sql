-- =============================================================================
-- 20260621120000_project_intake.sql  (Track C — next-gen intake wizard)
--
-- A multi-step, conditional-logic project intake for PROJECT-type clients.
--   * project_intakes : the client's draft (save-and-resume) + submitted answers,
--     keyed to the client. RLS = admin all / team assigned / client SELECT-own.
--     NO client direct write — clients write ONLY via the SECURITY DEFINER RPCs
--     (save_intake / submit_intake), own-client + project-type-gated.
--   * intake_config   : the step/field/branch schema + budget mapping as DATA
--     (one active jsonb row) so staff can adjust the wizard without code. Readable
--     by all authenticated (clients need it to render the form); admin writes.
--
-- submit_intake produces a REAL project via the canonical create_project RPC and,
-- when assets are still missing, a "Pending assets" task via create_task — never
-- escalating status (create_project always starts 'proposed'; the status lock holds).
--
-- NO credentials are stored here: the asset step uploads files to private storage;
-- access/credentials are collected as files or deferred to the kickoff call. The
-- answers jsonb must never contain plaintext secrets (enforced by the UI).
-- =============================================================================

create table public.project_intakes (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  status        text not null default 'draft' check (status in ('draft', 'submitted')),
  service       text,
  answers       jsonb not null default '{}'::jsonb,
  estimate_min  numeric,
  estimate_max  numeric,
  current_step  int not null default 0,
  project_id    uuid references public.projects (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  submitted_at  timestamptz
);
create index idx_project_intakes_client on public.project_intakes (client_id);
-- at most ONE resumable draft per client (save-and-resume target)
create unique index uq_one_draft_per_client on public.project_intakes (client_id) where (status = 'draft');
create trigger trg_project_intakes_updated_at
  before update on public.project_intakes
  for each row execute function public.set_updated_at();

alter table public.project_intakes enable row level security;
create policy "intake_admin_all" on public.project_intakes for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "intake_team_all" on public.project_intakes for all to authenticated using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "intake_client_read" on public.project_intakes for select to authenticated using (client_id = app.my_client_id());
-- NO client INSERT/UPDATE/DELETE policy — clients write via the RPCs below only.

-- ---- intake_config: the wizard schema + budget mapping as DATA ----------------
create table public.intake_config (
  id         uuid primary key default gen_random_uuid(),
  version    int not null default 1,
  config     jsonb not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_intake_config_updated_at
  before update on public.intake_config
  for each row execute function public.set_updated_at();
alter table public.intake_config enable row level security;
-- the form schema is reference data — readable by ALL authenticated (clients render
-- the form from it); only admin curates.
create policy "intake_config_read" on public.intake_config for select to authenticated using (true);
create policy "intake_config_admin" on public.intake_config for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---- RPC: save_intake — upsert the caller's draft (own project-client) --------
create or replace function public.save_intake(
  p_service text,
  p_answers jsonb,
  p_estimate_min numeric,
  p_estimate_max numeric,
  p_current_step int default 0
)
returns public.project_intakes
language plpgsql security definer set search_path = ''
as $$
declare
  v_client uuid := app.my_client_id();
  v_type   public.client_type;
  v_row    public.project_intakes;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  if v_client is null then raise exception 'Only clients can save an intake'; end if;
  select client_type into v_type from public.clients where id = v_client;
  if v_type is distinct from 'project' then raise exception 'Intake is for project clients only'; end if;

  insert into public.project_intakes (client_id, status, service, answers, estimate_min, estimate_max, current_step)
  values (v_client, 'draft', p_service, coalesce(p_answers, '{}'::jsonb), p_estimate_min, p_estimate_max, coalesce(p_current_step, 0))
  on conflict (client_id) where (status = 'draft')
  do update set service = excluded.service, answers = excluded.answers,
                estimate_min = excluded.estimate_min, estimate_max = excluded.estimate_max,
                current_step = excluded.current_step
  returning * into v_row;
  return v_row;
end;
$$;

-- ---- RPC: submit_intake — draft → a REAL project (+ optional pending task) -----
create or replace function public.submit_intake(
  p_service text,
  p_answers jsonb,
  p_estimate_min numeric,
  p_estimate_max numeric,
  p_title text,
  p_description text,
  p_priority public.project_priority,
  p_target_date date,
  p_missing_assets text[] default '{}'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_client uuid := app.my_client_id();
  v_type   public.client_type;
  v_proj   public.projects;
  v_missing text;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  if v_client is null then raise exception 'Only clients can submit an intake'; end if;
  select client_type into v_type from public.clients where id = v_client;
  if v_type is distinct from 'project' then raise exception 'Intake is for project clients only'; end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'Project name is required'; end if;

  -- the REAL project, via the canonical RPC (always starts 'proposed' — status lock holds)
  v_proj := public.create_project(p_title, p_description, coalesce(p_priority, 'medium'), p_target_date);

  -- mark the draft submitted + link the project (or insert a submitted record)
  update public.project_intakes
     set status = 'submitted', service = p_service, answers = coalesce(p_answers, '{}'::jsonb),
         estimate_min = p_estimate_min, estimate_max = p_estimate_max,
         project_id = v_proj.id, submitted_at = now()
   where client_id = v_client and status = 'draft';
  if not found then
    insert into public.project_intakes (client_id, status, service, answers, estimate_min, estimate_max, project_id, submitted_at)
    values (v_client, 'submitted', p_service, coalesce(p_answers, '{}'::jsonb), p_estimate_min, p_estimate_max, v_proj.id, now());
  end if;

  -- a client-visible "Pending assets" to-do when assets are still missing
  if p_missing_assets is not null and array_length(p_missing_assets, 1) > 0 then
    v_missing := array_to_string(p_missing_assets, ', ');
    perform public.create_task(
      'Pending assets — ' || btrim(p_title),
      'To kick off, we still need: ' || v_missing || '. Upload them any time from your project.',
      null, null, null
    );
  end if;

  return v_proj.id;
end;
$$;

revoke all on function public.save_intake(text, jsonb, numeric, numeric, int) from public, anon;
revoke all on function public.submit_intake(text, jsonb, numeric, numeric, text, text, public.project_priority, date, text[]) from public, anon;
grant execute on function public.save_intake(text, jsonb, numeric, numeric, int) to authenticated;
grant execute on function public.submit_intake(text, jsonb, numeric, numeric, text, text, public.project_priority, date, text[]) to authenticated;

-- ---- seed the default wizard config (staff-editable DATA) ---------------------
insert into public.intake_config (version, config) values (1, $cfg$
{
  "kickoff": { "calLink": "", "note": "Last step — pick a kickoff time and we'll dig in." },
  "services": [
    { "key": "web_dev", "label": "Web Development", "desc": "A new site, app, or web platform.", "estimateMin": 3000, "estimateMax": 9000 },
    { "key": "ai_automation", "label": "AI Automation", "desc": "Automations, agents, and integrations.", "estimateMin": 2500, "estimateMax": 8000 },
    { "key": "branding", "label": "Branding & Design", "desc": "Identity, guidelines, and collateral.", "estimateMin": 1500, "estimateMax": 5000 },
    { "key": "other", "label": "Something else", "desc": "Tell us what you have in mind.", "estimateMin": 1000, "estimateMax": 4000 }
  ],
  "steps": [
    { "key": "service", "title": "What can we build for you?", "fields": [
      { "key": "service", "type": "service", "label": "Project type", "required": true },
      { "key": "title", "type": "text", "label": "Project name", "required": true, "placeholder": "e.g. New marketing website" }
    ] },
    { "key": "goals", "title": "Goals & timeline", "fields": [
      { "key": "goal", "type": "textarea", "label": "What outcome do you want?", "required": true, "placeholder": "The problem this solves, who it's for, what success looks like." },
      { "key": "priority", "type": "select", "label": "Priority", "required": true, "default": "medium", "options": [ { "value": "low", "label": "Low" }, { "value": "medium", "label": "Medium" }, { "value": "high", "label": "High" }, { "value": "urgent", "label": "Urgent" } ] },
      { "key": "target_date", "type": "date", "label": "Ideal launch date (optional)" }
    ] },
    { "key": "web", "title": "Web details", "showIf": { "field": "service", "equals": "web_dev" }, "fields": [
      { "key": "tech_stack", "type": "select", "label": "Tech preference", "required": true, "default": "none", "options": [ { "value": "none", "label": "No preference" }, { "value": "next", "label": "React / Next.js" }, { "value": "wordpress", "label": "WordPress" }, { "value": "other", "label": "Other" } ] },
      { "key": "has_domain", "type": "radio", "label": "Do you have a domain?", "required": true, "options": [ { "value": "yes", "label": "Yes" }, { "value": "no", "label": "Not yet" } ] },
      { "key": "hosting", "type": "radio", "label": "Hosting / domain access", "required": true, "options": [ { "value": "have", "label": "I can provide access" }, { "value": "help", "label": "I'll need help" }, { "value": "na", "label": "N/A" } ] }
    ] },
    { "key": "ai", "title": "Automation details", "showIf": { "field": "service", "equals": "ai_automation" }, "fields": [
      { "key": "current_stack", "type": "multiselect", "label": "Tools you use today", "options": [ { "value": "zapier", "label": "Zapier" }, { "value": "make", "label": "Make" }, { "value": "n8n", "label": "n8n" }, { "value": "custom_api", "label": "Custom APIs" }, { "value": "none", "label": "None yet" } ] },
      { "key": "systems", "type": "textarea", "label": "What systems should connect?", "required": true, "placeholder": "e.g. our CRM to email + Slack, with AI lead scoring." },
      { "key": "data_sensitivity", "type": "radio", "label": "Data sensitivity", "required": true, "options": [ { "value": "low", "label": "Low" }, { "value": "medium", "label": "Medium" }, { "value": "high", "label": "High / regulated" } ] }
    ] },
    { "key": "brand", "title": "Branding details", "showIf": { "field": "service", "equals": "branding" }, "fields": [
      { "key": "branding_scope", "type": "multiselect", "label": "What do you need?", "required": true, "options": [ { "value": "logo", "label": "Logo" }, { "value": "guidelines", "label": "Brand guidelines" }, { "value": "collateral", "label": "Collateral" }, { "value": "web", "label": "Web design" } ] },
      { "key": "have_brand", "type": "radio", "label": "Existing brand?", "required": true, "options": [ { "value": "yes", "label": "Yes — refresh it" }, { "value": "no", "label": "No — from scratch" } ] }
    ] },
    { "key": "scope", "title": "Scope & features", "fields": [
      { "key": "features", "type": "multiselect", "label": "Add the pieces you'll need", "help": "Each adds to your estimate.", "options": [
        { "value": "copywriting", "label": "Copywriting", "addMin": 500, "addMax": 1500 },
        { "value": "integrations", "label": "3rd-party integrations", "addMin": 800, "addMax": 2500 },
        { "value": "ai_features", "label": "AI features", "addMin": 1000, "addMax": 3000 },
        { "value": "analytics", "label": "Analytics & tracking", "addMin": 300, "addMax": 900 },
        { "value": "ongoing", "label": "Ongoing support", "addMin": 500, "addMax": 2000 }
      ] },
      { "key": "timeline", "type": "radio", "label": "Timeline", "required": true, "default": "standard", "options": [ { "value": "standard", "label": "Standard" }, { "value": "rush", "label": "Rush", "mult": 1.25 } ] }
    ] },
    { "key": "assets", "title": "Brand assets & access", "fields": [
      { "key": "assets", "type": "assets", "label": "Upload brand guidelines, logos, or an access doc" }
    ] },
    { "key": "review", "title": "Review & submit", "fields": [
      { "key": "notes", "type": "textarea", "label": "Anything else? (optional)", "placeholder": "Links, references, constraints." }
    ] }
  ]
}
$cfg$::jsonb);
