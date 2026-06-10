-- =============================================================================
-- 20260610010002_tables.sql
-- All public tables (spec §4 "Tables"), indexes, and the updated_at trigger.
-- RLS is ENABLED here but policies are defined in 20260610010004_rls_policies.sql.
-- =============================================================================

-- --- shared updated_at trigger fn ------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --- clients --------------------------------------------------------------------
-- primary_contact_user_id FK is added AFTER profiles exists (circular reference).
create table public.clients (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  slug                     text not null unique,
  industry                 public.client_industry not null,
  program                  public.program_tier not null,
  status                   public.client_status not null default 'onboarding',
  website_url              text,
  logo_url                 text,
  start_date               date,
  end_date                 date,
  service_type             text,
  investment               text,
  onboarding_form_url      text,
  welcome_doc_url          text,
  comms_channel            text,
  primary_contact_user_id  uuid,
  whats_included           text,
  whats_not_included       text,
  best_way_to_reach        text,
  response_time            text,
  call_scheduling_note     text,
  revision_policy          text,
  internal_notes           text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- --- profiles -------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'client',
  full_name   text,
  email       text,
  avatar_url  text,
  client_id   uuid references public.clients (id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- now that profiles exists, wire the clients -> "Your Partner" FK
alter table public.clients
  add constraint clients_primary_contact_fk
  foreign key (primary_contact_user_id)
  references public.profiles (id) on delete set null;

-- --- client_assignments ---------------------------------------------------------
create table public.client_assignments (
  client_id    uuid not null references public.clients (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  assigned_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (client_id, user_id)
);

-- --- checklist_items ------------------------------------------------------------
create table public.checklist_items (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  kind               public.checklist_kind not null,
  phase_label        text,
  title              text not null,
  link_url           text,
  assignee           public.checklist_assignee not null default 'client',
  sort_order         int not null default 0,
  is_done            boolean not null default false,
  done_by            uuid references public.profiles (id) on delete set null,
  done_at            timestamptz,
  visible_to_client  boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- --- milestones -----------------------------------------------------------------
create table public.milestones (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  title              text not null,
  description        text,
  phase_label        text,
  status             public.milestone_status not null default 'upcoming',
  due_date           date,
  sort_order         int not null default 0,
  visible_to_client  boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- --- deliverables ---------------------------------------------------------------
create table public.deliverables (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  title              text not null,
  description        text,
  type               public.deliverable_type not null default 'other',
  status             public.deliverable_status not null default 'pending',
  due_date           date,
  preview_url        text,
  file_path          text,
  visible_to_client  boolean not null default false,
  delivered_at       timestamptz,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- --- content_items --------------------------------------------------------------
create table public.content_items (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.clients (id) on delete cascade,
  title                text not null,
  platform             public.content_platform not null default 'other',
  content_type         text,
  status               public.content_status not null default 'idea',
  publish_date         date,
  cta                  text,
  core_message         text,
  notes                text,
  asset_url            text,
  views_after_posting  numeric,
  visible_to_client    boolean not null default true,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- --- metric_definitions ---------------------------------------------------------
create table public.metric_definitions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  key         text not null,
  label       text not null,
  unit        public.metric_unit not null default 'number',
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client_id, key)
);

-- --- metric_entries -------------------------------------------------------------
create table public.metric_entries (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete cascade,
  definition_id  uuid not null references public.metric_definitions (id) on delete cascade,
  period         date not null,
  value_numeric  numeric,
  value_text     text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (definition_id, period)
);

-- --- competitors ----------------------------------------------------------------
create table public.competitors (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients (id) on delete cascade,
  name_or_handle      text not null,
  niche               text,
  follower_count      int,
  avg_views           int,
  top_content_format  text,
  hook_style          text,
  whats_working       text,
  gap_notes           text,
  adapted_idea        text,
  priority            public.competitor_priority not null default 'medium',
  visible_to_client   boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- --- call_types -----------------------------------------------------------------
create table public.call_types (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete cascade,
  name             text not null,
  duration_label   text,
  frequency_label  text,
  booking_url      text,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- --- call_recordings ------------------------------------------------------------
create table public.call_recordings (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  call_date          date,
  call_type          text,
  recording_url      text,
  key_topic          text,
  visible_to_client  boolean not null default true,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- --- meeting_notes --------------------------------------------------------------
create table public.meeting_notes (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  meeting_date       date,
  title              text,
  body               text,
  visible_to_client  boolean not null default true,
  author_id          uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- --- reports --------------------------------------------------------------------
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  title         text not null,
  period_start  date,
  period_end    date,
  summary       text,
  pdf_path      text,
  published     boolean not null default false,
  published_at  timestamptz,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- --- updates --------------------------------------------------------------------
create table public.updates (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  author_id          uuid references public.profiles (id) on delete set null,
  title              text not null,
  body               text,
  pinned             boolean not null default false,
  visible_to_client  boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- --- files ----------------------------------------------------------------------
create table public.files (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  name               text not null,
  category           public.file_category not null default 'other',
  storage_path       text not null,
  mime_type          text,
  size_bytes         bigint,
  visible_to_client  boolean not null default false,
  uploaded_by        uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);

-- --- invitations ----------------------------------------------------------------
create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  role         public.user_role not null,
  client_id    uuid references public.clients (id) on delete cascade,
  invited_by   uuid references public.profiles (id) on delete set null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now(),
  -- client invites must carry a client_id (spec §4)
  constraint invitations_client_required
    check (role <> 'client' or client_id is not null)
);

-- --- audit_log ------------------------------------------------------------------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity      text,
  entity_id   uuid,
  client_id   uuid references public.clients (id) on delete set null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- Indexes on every client_id FK + hot lookup paths
-- =============================================================================
create index idx_profiles_client_id          on public.profiles (client_id);
create index idx_client_assignments_user     on public.client_assignments (user_id);
create index idx_checklist_items_client      on public.checklist_items (client_id);
create index idx_checklist_items_kind        on public.checklist_items (client_id, kind);
create index idx_milestones_client           on public.milestones (client_id);
create index idx_deliverables_client         on public.deliverables (client_id);
create index idx_content_items_client        on public.content_items (client_id);
create index idx_metric_definitions_client   on public.metric_definitions (client_id);
create index idx_metric_entries_client       on public.metric_entries (client_id);
create index idx_metric_entries_definition   on public.metric_entries (definition_id);
create index idx_competitors_client          on public.competitors (client_id);
create index idx_call_types_client           on public.call_types (client_id);
create index idx_call_recordings_client      on public.call_recordings (client_id);
create index idx_meeting_notes_client        on public.meeting_notes (client_id);
create index idx_reports_client              on public.reports (client_id);
create index idx_updates_client              on public.updates (client_id);
create index idx_files_client                on public.files (client_id);
create index idx_invitations_email           on public.invitations (email);
create index idx_audit_log_client            on public.audit_log (client_id);
create index idx_audit_log_actor             on public.audit_log (actor_id);

-- =============================================================================
-- updated_at triggers (all tables that carry updated_at)
-- =============================================================================
create trigger trg_clients_updated_at            before update on public.clients            for each row execute function public.set_updated_at();
create trigger trg_profiles_updated_at           before update on public.profiles           for each row execute function public.set_updated_at();
create trigger trg_checklist_items_updated_at    before update on public.checklist_items    for each row execute function public.set_updated_at();
create trigger trg_milestones_updated_at         before update on public.milestones         for each row execute function public.set_updated_at();
create trigger trg_deliverables_updated_at       before update on public.deliverables       for each row execute function public.set_updated_at();
create trigger trg_content_items_updated_at      before update on public.content_items      for each row execute function public.set_updated_at();
create trigger trg_metric_definitions_updated_at before update on public.metric_definitions for each row execute function public.set_updated_at();
create trigger trg_metric_entries_updated_at     before update on public.metric_entries     for each row execute function public.set_updated_at();
create trigger trg_competitors_updated_at        before update on public.competitors        for each row execute function public.set_updated_at();
create trigger trg_call_types_updated_at         before update on public.call_types         for each row execute function public.set_updated_at();
create trigger trg_call_recordings_updated_at    before update on public.call_recordings    for each row execute function public.set_updated_at();
create trigger trg_meeting_notes_updated_at      before update on public.meeting_notes      for each row execute function public.set_updated_at();
create trigger trg_reports_updated_at            before update on public.reports            for each row execute function public.set_updated_at();
create trigger trg_updates_updated_at            before update on public.updates            for each row execute function public.set_updated_at();

-- =============================================================================
-- Enable RLS on every table (policies follow in 20260610010004_rls_policies.sql).
-- Until policies exist, only service_role / table owner can access these tables.
-- =============================================================================
alter table public.clients            enable row level security;
alter table public.profiles           enable row level security;
alter table public.client_assignments enable row level security;
alter table public.checklist_items    enable row level security;
alter table public.milestones         enable row level security;
alter table public.deliverables       enable row level security;
alter table public.content_items      enable row level security;
alter table public.metric_definitions enable row level security;
alter table public.metric_entries     enable row level security;
alter table public.competitors        enable row level security;
alter table public.call_types         enable row level security;
alter table public.call_recordings    enable row level security;
alter table public.meeting_notes      enable row level security;
alter table public.reports            enable row level security;
alter table public.updates            enable row level security;
alter table public.files              enable row level security;
alter table public.invitations        enable row level security;
alter table public.audit_log          enable row level security;
