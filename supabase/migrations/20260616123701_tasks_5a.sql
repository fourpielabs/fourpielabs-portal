-- =============================================================================
-- 20260616123701_tasks_5a.sql  — Phase 5a: Tasks data layer
-- A shared to-do system between staff and clients (both directions). RLS scoped
-- like every other client-data table: admin all · team assigned · client own
-- client. Clients write ONLY via the two SECURITY DEFINER RPCs below — NO direct
-- client INSERT/UPDATE/DELETE policy (the toggle_checklist_item / create_project /
-- set_deliverable_approval precedent).
--
-- `visible_to_client` (mirrors deliverables): the internal-thread boundary mandates
-- it — a task created from an INTERNAL chat message (5c) is staff-only and must be
-- invisible to the client. Default TRUE (ordinary tasks are client-visible); only
-- internal-message tasks set it FALSE.
-- =============================================================================

create type public.task_status as enum ('todo', 'in_progress', 'done');

create table public.tasks (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  title             text not null,
  description       text,
  status            public.task_status not null default 'todo',
  assignee_id       uuid references public.profiles (id) on delete set null,   -- staff OR client; nullable
  due_date          date,
  visible_to_client boolean not null default true,
  source_message_id uuid references public.messages (id) on delete set null,   -- set when created from chat
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_tasks_client   on public.tasks (client_id);
create index idx_tasks_assignee on public.tasks (assignee_id);
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy "tasks_admin_all" on public.tasks
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "tasks_team_all" on public.tasks
  for all to authenticated
  using (app.is_assigned(client_id)) with check (app.is_assigned(client_id));
create policy "tasks_client_select" on public.tasks
  for select to authenticated
  using (client_id = app.my_client_id() and visible_to_client);
-- NO client INSERT/UPDATE/DELETE policy — clients write only via the RPCs below.

-- ---- RPC 1: create_task (client write) -------------------------------------
-- Validates: caller is a client (my_client_id not null) · title non-empty ·
-- assignee (if any) is a MEMBER OF THIS CLIENT'S CIRCLE (a user of this client,
-- an assigned team member, or an admin) — never an arbitrary user · source
-- message (if any) is one of the CLIENT'S OWN client_shared messages (never
-- internal). Client-created tasks are always visible_to_client = true.
create or replace function public.create_task(
  p_title text,
  p_description text default null,
  p_assignee uuid default null,
  p_due_date date default null,
  p_source_message_id uuid default null
)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_client uuid := app.my_client_id();
  v_row    public.tasks;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_client is null then raise exception 'Only clients can create tasks here'; end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'Title is required'; end if;

  if p_assignee is not null and not exists (
    select 1 from public.profiles p
    where p.id = p_assignee and p.is_active and (
         p.client_id = v_client
      or p.role = 'admin'
      or exists (select 1 from public.client_assignments ca
                 where ca.client_id = v_client and ca.user_id = p.id)
    )
  ) then
    raise exception 'Assignee must be a member of this client''s circle';
  end if;

  if p_source_message_id is not null and not exists (
    select 1 from public.messages m
    where m.id = p_source_message_id
      and m.client_id = v_client
      and m.thread_type = 'client_shared'
  ) then
    raise exception 'Source message not found for this client';
  end if;

  insert into public.tasks (client_id, title, description, status, assignee_id,
                            due_date, visible_to_client, source_message_id, created_by)
  values (v_client, btrim(p_title), nullif(btrim(p_description), ''), 'todo', p_assignee,
          p_due_date, true, p_source_message_id, v_uid)
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.create_task(text, text, uuid, date, uuid) from public, anon;
grant execute on function public.create_task(text, text, uuid, date, uuid) to authenticated;

-- ---- RPC 2: update_task_status (client write) ------------------------------
-- A client may change status only on their OWN client's VISIBLE tasks. An
-- internal/staff-only task (visible_to_client = false) is invisible and untouchable.
create or replace function public.update_task_status(
  p_task_id uuid,
  p_status public.task_status
)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_client uuid := app.my_client_id();
  v_row    public.tasks;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  if v_client is null then raise exception 'Only clients can update tasks here'; end if;

  select * into v_row from public.tasks where id = p_task_id;
  if not found then raise exception 'Task not found'; end if;
  if v_row.client_id is distinct from v_client or not v_row.visible_to_client then
    raise exception 'Not authorized for this task';
  end if;

  update public.tasks set status = p_status where id = p_task_id returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.update_task_status(uuid, public.task_status) from public, anon;
grant execute on function public.update_task_status(uuid, public.task_status) to authenticated;
