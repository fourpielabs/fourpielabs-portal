-- =============================================================================
-- 20260618143121_project_advanced_options.sql — Phase 3: advanced project options
--
-- Adds two client-settable fields to public.projects and threads them through the
-- client create_project / update_project SECURITY DEFINER RPCs:
--   * priority    project_priority NOT NULL default 'medium'  (low|medium|high|urgent)
--   * target_date date (nullable) — the CLIENT's desired date, DISTINCT from the
--                  staff-managed due_date (which already exists and stays staff-only).
-- The existing `description` column is reused as the project "brief" (a presentation
-- upgrade to a real textarea — no new column).
--
-- ⛔ STATUS LOCK PRESERVED: the client RPCs gain p_priority + p_target_date ONLY.
-- Neither RPC's UPDATE/INSERT touches `status` or `due_date` — so the project-status
-- lock (20260617183715) and staff-only due_date both hold. A client still has no path
-- to status or due_date. No direct client write policy is added (RPC-only, own-client).
-- Staff continue to set everything via direct table writes (lib/actions/projects.ts).
-- =============================================================================

create type public.project_priority as enum ('low', 'medium', 'high', 'urgent');

alter table public.projects
  add column priority public.project_priority not null default 'medium',
  add column target_date date;

-- ---- create_project: + priority + target_date (client-settable) -------------
-- status is still hard-coded 'proposed'; due_date is NOT set here (staff-only).
drop function if exists public.create_project(text, text);
create or replace function public.create_project(
  p_title text,
  p_description text,
  p_priority public.project_priority default 'medium',
  p_target_date date default null
)
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

  insert into public.projects (client_id, title, description, status, priority, target_date, created_by)
  values (
    v_client,
    btrim(p_title),
    nullif(btrim(p_description), ''),
    'proposed',
    coalesce(p_priority, 'medium'),
    p_target_date,
    (select auth.uid())
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- ---- update_project: + priority + target_date ------------------------------
-- The SET clause is title/description/priority/target_date ONLY — `status` and
-- `due_date` are deliberately absent, so a client edit preserves both untouched.
-- (Recreate over the post-lock 3-arg signature; the old status-settable 4-arg was
-- already dropped by 20260617183715.)
drop function if exists public.update_project(uuid, text, text);
create or replace function public.update_project(
  p_id uuid,
  p_title text,
  p_description text,
  p_priority public.project_priority default 'medium',
  p_target_date date default null
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
         priority = coalesce(p_priority, 'medium'),
         target_date = p_target_date
   where id = p_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.create_project(text, text, public.project_priority, date) from public, anon;
revoke all on function public.update_project(uuid, text, text, public.project_priority, date) from public, anon;
grant execute on function public.create_project(text, text, public.project_priority, date) to authenticated;
grant execute on function public.update_project(uuid, text, text, public.project_priority, date) to authenticated;
