-- =============================================================================
-- 20260618134914_task_checklist_subtasks.sql — Phase 4: task subtasks
--
-- Checklist-style items under a parent task (lightweight title + done flag) + a
-- parent done/total progress bar. READ + WRITE visibility FOLLOWS THE PARENT TASK:
--   admin all · team is_assigned(parent.client_id) · client own + visible_to_client.
-- Clients write ONLY via the four SECURITY DEFINER RPCs below — there is NO direct
-- client INSERT/UPDATE/DELETE policy (the toggle_checklist_item / update_task
-- precedent). The internal-thread boundary is inherited from the parent: an item
-- under an invisible / internal / cross-client task is unreadable + untouchable by
-- a client. NAMING: all four carry the `task_checklist` infix — they do NOT collide
-- with the onboarding toggle_checklist_item(uuid) on public.checklist_items.
-- =============================================================================

create table public.task_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  title       text not null,
  is_done     boolean not null default false,
  sort_order  int not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_task_checklist_items_task on public.task_checklist_items (task_id);
create trigger trg_task_checklist_items_updated_at
  before update on public.task_checklist_items
  for each row execute function public.set_updated_at();

alter table public.task_checklist_items enable row level security;

-- ---- RLS: keyed on the PARENT task (mirrors public.tasks' three policies) ----
-- is_admin() is global; is_assigned()/the client branch gate on the parent task.
-- The client branch (t.client_id = my_client_id() AND t.visible_to_client) is NULL
-- for staff (my_client_id() null) → self-excludes; staff read via the for-all ones.
create policy "task_checklist_items_select" on public.task_checklist_items
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_checklist_items.task_id
        and (
             app.is_admin()
          or app.is_assigned(t.client_id)
          or (t.client_id = app.my_client_id() and t.visible_to_client)
        )
    )
  );

-- staff for-all writes (admin global; team parent-gated) — symmetric with tasks.
create policy "task_checklist_items_admin_all" on public.task_checklist_items
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "task_checklist_items_team_all" on public.task_checklist_items
  for all to authenticated
  using (exists (select 1 from public.tasks t
                 where t.id = task_checklist_items.task_id and app.is_assigned(t.client_id)))
  with check (exists (select 1 from public.tasks t
                 where t.id = task_checklist_items.task_id and app.is_assigned(t.client_id)));
-- NO client INSERT/UPDATE/DELETE policy — clients write only via the RPCs below.

-- ---- the parent-task gate every client RPC re-validates ----------------------
-- (inlined per RPC; raises unless the parent task is the caller's OWN client AND
--  visible_to_client — so an internal/invisible/cross-client parent is untouchable.)

-- ---- RPC 1: add_task_checklist_item ------------------------------------------
create or replace function public.add_task_checklist_item(p_task_id uuid, p_title text)
returns public.task_checklist_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_client uuid := app.my_client_id();
  v_task   public.tasks;
  v_item   public.task_checklist_items;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_client is null then raise exception 'Only clients can edit task items here'; end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'Title is required'; end if;

  select * into v_task from public.tasks where id = p_task_id;
  if not found then raise exception 'Task not found'; end if;
  if v_task.client_id is distinct from v_client or not v_task.visible_to_client then
    raise exception 'Not authorized for this task';
  end if;

  insert into public.task_checklist_items (task_id, title, sort_order, created_by)
  values (
    p_task_id,
    btrim(p_title),
    coalesce((select max(sort_order) + 1 from public.task_checklist_items where task_id = p_task_id), 0),
    v_uid
  )
  returning * into v_item;
  return v_item;
end;
$$;
revoke all on function public.add_task_checklist_item(uuid, text) from public, anon;
grant execute on function public.add_task_checklist_item(uuid, text) to authenticated;

-- ---- RPC 2: toggle_task_checklist_item ---------------------------------------
create or replace function public.toggle_task_checklist_item(p_item_id uuid)
returns public.task_checklist_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_client uuid := app.my_client_id();
  v_item   public.task_checklist_items;
  v_task   public.tasks;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  if v_client is null then raise exception 'Only clients can edit task items here'; end if;

  select * into v_item from public.task_checklist_items where id = p_item_id;
  if not found then raise exception 'Checklist item not found'; end if;
  select * into v_task from public.tasks where id = v_item.task_id;
  if not found then raise exception 'Task not found'; end if;
  if v_task.client_id is distinct from v_client or not v_task.visible_to_client then
    raise exception 'Not authorized for this item';
  end if;

  update public.task_checklist_items set is_done = not v_item.is_done
   where id = p_item_id returning * into v_item;
  return v_item;
end;
$$;
revoke all on function public.toggle_task_checklist_item(uuid) from public, anon;
grant execute on function public.toggle_task_checklist_item(uuid) to authenticated;

-- ---- RPC 3: edit_task_checklist_item -----------------------------------------
create or replace function public.edit_task_checklist_item(p_item_id uuid, p_title text)
returns public.task_checklist_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_client uuid := app.my_client_id();
  v_item   public.task_checklist_items;
  v_task   public.tasks;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  if v_client is null then raise exception 'Only clients can edit task items here'; end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'Title is required'; end if;

  select * into v_item from public.task_checklist_items where id = p_item_id;
  if not found then raise exception 'Checklist item not found'; end if;
  select * into v_task from public.tasks where id = v_item.task_id;
  if not found then raise exception 'Task not found'; end if;
  if v_task.client_id is distinct from v_client or not v_task.visible_to_client then
    raise exception 'Not authorized for this item';
  end if;

  update public.task_checklist_items set title = btrim(p_title)
   where id = p_item_id returning * into v_item;
  return v_item;
end;
$$;
revoke all on function public.edit_task_checklist_item(uuid, text) from public, anon;
grant execute on function public.edit_task_checklist_item(uuid, text) to authenticated;

-- ---- RPC 4: delete_task_checklist_item ---------------------------------------
create or replace function public.delete_task_checklist_item(p_item_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_client uuid := app.my_client_id();
  v_item   public.task_checklist_items;
  v_task   public.tasks;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  if v_client is null then raise exception 'Only clients can edit task items here'; end if;

  select * into v_item from public.task_checklist_items where id = p_item_id;
  if not found then raise exception 'Checklist item not found'; end if;
  select * into v_task from public.tasks where id = v_item.task_id;
  if not found then raise exception 'Task not found'; end if;
  if v_task.client_id is distinct from v_client or not v_task.visible_to_client then
    raise exception 'Not authorized for this item';
  end if;

  delete from public.task_checklist_items where id = p_item_id;
end;
$$;
revoke all on function public.delete_task_checklist_item(uuid) from public, anon;
grant execute on function public.delete_task_checklist_item(uuid) to authenticated;
