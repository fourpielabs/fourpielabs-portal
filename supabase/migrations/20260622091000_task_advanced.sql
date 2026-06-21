-- =============================================================================
-- 20260622091000_task_advanced.sql  (Track D — dependencies, blocked-by-client,
--                                    milestone sign-off)
--
-- ADDITIVE. Three pieces, all preserving the four invariants — especially the
-- TASK-STATUS LOCK: nothing here gives a client a status-write path.
--   1. tasks gains is_milestone, blocked_by_client, blocked_reason,
--      client_signed_off_at — staff-set flags + ONE client-writable timestamp
--      (set only via the sign-off RPC; mirrors deliverables.client_approved_at).
--   2. task_dependencies (task → blocked_by_task), staff-managed, same-client,
--      RLS following task visibility (client read-only).
--   3. sign_off_milestone RPC: a client records FORMAL (logged, not legally
--      binding) acceptance of a milestone task — sets client_signed_off_at ONLY,
--      never status. (IP + audit are recorded by the server action.)
-- =============================================================================

alter table public.tasks
  add column is_milestone        boolean not null default false,
  add column blocked_by_client   boolean not null default false,
  add column blocked_reason      text,
  add column client_signed_off_at timestamptz;

-- ---- task_dependencies: a task is "blocked by" another (same client) ----------
create table public.task_dependencies (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references public.tasks (id) on delete cascade,
  blocked_by_task_id uuid not null references public.tasks (id) on delete cascade,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (task_id, blocked_by_task_id),
  check (task_id <> blocked_by_task_id)
);
create index idx_task_deps_task on public.task_dependencies (task_id);
create index idx_task_deps_blocker on public.task_dependencies (blocked_by_task_id);

-- both ends must belong to the SAME client (no cross-client dependencies)
create or replace function public.enforce_task_dep_same_client()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a uuid; b uuid;
begin
  select client_id into a from public.tasks where id = new.task_id;
  select client_id into b from public.tasks where id = new.blocked_by_task_id;
  if a is null or b is null then raise exception 'Both tasks must exist'; end if;
  if a is distinct from b then raise exception 'A dependency must be within the same client'; end if;
  return new;
end;
$$;
create trigger trg_task_deps_same_client
  before insert or update on public.task_dependencies
  for each row execute function public.enforce_task_dep_same_client();

alter table public.task_dependencies enable row level security;
-- staff manage; client reads deps only on tasks they can see. No client write.
create policy "task_deps_admin_all" on public.task_dependencies
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "task_deps_team_all" on public.task_dependencies
  for all to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_dependencies.task_id and app.is_assigned(t.client_id)))
  with check (exists (select 1 from public.tasks t where t.id = task_dependencies.task_id and app.is_assigned(t.client_id)));
create policy "task_deps_client_select" on public.task_dependencies
  for select to authenticated
  using (exists (select 1 from public.tasks t
                 where t.id = task_dependencies.task_id
                   and t.client_id = app.my_client_id() and t.visible_to_client));

-- ---- RPC: sign_off_milestone (client formal acceptance; NOT status) -----------
-- The ONLY client write here. Mirrors set_deliverable_approval: own-client +
-- visible + (here) milestone-only. Sets client_signed_off_at ONLY — never status,
-- so the task-status lock holds. IP + the audit_log row are written by the action.
create or replace function public.sign_off_milestone(p_task_id uuid)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_client uuid := app.my_client_id();
  v_row    public.tasks;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_client is null then raise exception 'Only clients can sign off'; end if;
  select * into v_row from public.tasks where id = p_task_id;
  if not found then raise exception 'Task not found'; end if;
  if v_row.client_id is distinct from v_client then raise exception 'Not authorized for this task'; end if;
  if not v_row.visible_to_client then raise exception 'This task is not visible to the client'; end if;
  if not v_row.is_milestone then raise exception 'Only milestones can be signed off'; end if;

  update public.tasks set client_signed_off_at = now() where id = p_task_id returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.sign_off_milestone(uuid) from public, anon;
grant execute on function public.sign_off_milestone(uuid) to authenticated;
