-- Lock project status to staff.
--
-- Security fix: the client-callable update_project RPC accepted a p_status arg
-- and wrote it straight to projects.status (own-client check only), so a client
-- could move their project to ANY status (proposed → active → in_review →
-- complete) — a staff-only decision. Model: staff control status; clients
-- create + edit title/description only and see status read-only.
--
-- Fix: DROP the 4-arg client RPC and recreate it WITHOUT p_status. status is no
-- longer in the UPDATE's SET clause, so it is PRESERVED untouched on a client
-- edit — clients can never change it through this path. create_project already
-- hard-codes status='proposed' (unchanged).
--
-- Staff status control is UNAFFECTED: staff write status via DIRECT table writes
-- (lib/actions/projects.ts → staffUpdateProjectAction / staffSetProjectStatusAction),
-- under the projects_admin_all / projects_team_all for-all policies — NOT this RPC.

-- old 4-arg overload (status-settable) is gone for good
drop function if exists public.update_project(uuid, text, text, public.project_status);

-- recreate: title + description only; status is never touched here
create or replace function public.update_project(
  p_id uuid,
  p_title text,
  p_description text
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
         description = nullif(btrim(p_description), '')
   where id = p_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.update_project(uuid, text, text) from public, anon;
grant execute on function public.update_project(uuid, text, text) to authenticated;
