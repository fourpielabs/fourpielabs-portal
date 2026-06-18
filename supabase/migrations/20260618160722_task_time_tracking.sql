-- =============================================================================
-- 20260618160722_task_time_tracking.sql — Phase 5: STAFF-ONLY time tracking
--
-- A staff timer on a task. time_entries belong to the staff member who logged
-- them; READ + WRITE follow the parent task's client (admin all · team
-- is_assigned(parent.client_id)). There is NO client policy of any kind — a client
-- has ZERO access to time data (read or write), and the timer UI lives only in the
-- staff detail. Writes go through the SECURITY DEFINER RPCs below (start/stop/edit/
-- delete), each re-validating assigned-staff (+ own-entry for stop/edit/delete).
--
-- STATUS MODEL (wired to the staff status path):
--   * start_timer        → task.status := 'in_progress'
--   * stop_timer(false)  → clock stops; status UNCHANGED (stays in_progress)
--   * stop_timer(true)   → clock stops AND task.status := 'done'  ("Stop & complete")
-- A plain stop NEVER completes. One running entry per (user, task) is enforced.
-- =============================================================================

create table public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,          -- null = running
  created_at  timestamptz not null default now()
);
create index idx_time_entries_task on public.time_entries (task_id);
create index idx_time_entries_user on public.time_entries (user_id);
-- at most ONE running entry per (task, user)
create unique index uniq_running_time_entry
  on public.time_entries (task_id, user_id) where ended_at is null;

alter table public.time_entries enable row level security;

-- ---- RLS: staff only (keyed on the parent task); NO client policy -----------
create policy "time_entries_admin_all" on public.time_entries
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "time_entries_team_all" on public.time_entries
  for all to authenticated
  using (exists (select 1 from public.tasks t
                 where t.id = time_entries.task_id and app.is_assigned(t.client_id)))
  with check (exists (select 1 from public.tasks t
                 where t.id = time_entries.task_id and app.is_assigned(t.client_id)));
-- (no client policy → clients cannot SELECT/INSERT/UPDATE/DELETE time_entries.)

-- ---- assigned-staff gate every RPC re-checks --------------------------------
-- (inlined: is_admin OR is_assigned(parent task's client_id); raises otherwise —
--  a client is neither, so every RPC raises for a client. stop/edit/delete also
--  require own-entry, user_id = auth.uid().)

-- ---- RPC: start_timer → in_progress, one-running enforced -------------------
create or replace function public.start_timer(p_task_id uuid)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_task  public.tasks;
  v_entry public.time_entries;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_task from public.tasks where id = p_task_id;
  if not found then raise exception 'Task not found'; end if;
  if not (app.is_admin() or app.is_assigned(v_task.client_id)) then
    raise exception 'Not authorized for this task';
  end if;
  if exists (
    select 1 from public.time_entries
    where task_id = p_task_id and user_id = v_uid and ended_at is null
  ) then
    raise exception 'A timer is already running for this task';
  end if;

  insert into public.time_entries (task_id, user_id, started_at)
  values (p_task_id, v_uid, now())
  returning * into v_entry;

  -- start → the task moves to in_progress (status is staff-controlled; consistent).
  update public.tasks set status = 'in_progress' where id = p_task_id;
  return v_entry;
end;
$$;

-- ---- RPC: stop_timer(p_complete) — plain stop NEVER completes ----------------
create or replace function public.stop_timer(p_entry_id uuid, p_complete boolean default false)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_entry public.time_entries;
  v_task  public.tasks;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_entry from public.time_entries where id = p_entry_id;
  if not found then raise exception 'Time entry not found'; end if;
  select * into v_task from public.tasks where id = v_entry.task_id;
  if not (app.is_admin() or app.is_assigned(v_task.client_id)) then
    raise exception 'Not authorized for this entry';
  end if;
  if v_entry.user_id is distinct from v_uid then
    raise exception 'You can only stop your own timer';
  end if;
  if v_entry.ended_at is not null then
    raise exception 'This timer is already stopped';
  end if;

  update public.time_entries set ended_at = now() where id = p_entry_id returning * into v_entry;

  -- Stop & complete → done; a PLAIN stop leaves status untouched (stays in_progress).
  if p_complete then
    update public.tasks set status = 'done' where id = v_entry.task_id;
  end if;
  return v_entry;
end;
$$;

-- ---- RPC: edit_time_entry — own entry, manual correction --------------------
create or replace function public.edit_time_entry(
  p_entry_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz
)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_entry public.time_entries;
  v_task  public.tasks;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_started_at is null then raise exception 'Start time is required'; end if;
  select * into v_entry from public.time_entries where id = p_entry_id;
  if not found then raise exception 'Time entry not found'; end if;
  select * into v_task from public.tasks where id = v_entry.task_id;
  if not (app.is_admin() or app.is_assigned(v_task.client_id)) then
    raise exception 'Not authorized for this entry';
  end if;
  if v_entry.user_id is distinct from v_uid then
    raise exception 'You can only edit your own entries';
  end if;
  if p_ended_at is not null and p_ended_at < p_started_at then
    raise exception 'End must be after start';
  end if;

  update public.time_entries
     set started_at = p_started_at, ended_at = p_ended_at
   where id = p_entry_id
  returning * into v_entry;
  return v_entry;
end;
$$;

-- ---- RPC: delete_time_entry — own entry -------------------------------------
create or replace function public.delete_time_entry(p_entry_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_entry public.time_entries;
  v_task  public.tasks;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_entry from public.time_entries where id = p_entry_id;
  if not found then raise exception 'Time entry not found'; end if;
  select * into v_task from public.tasks where id = v_entry.task_id;
  if not (app.is_admin() or app.is_assigned(v_task.client_id)) then
    raise exception 'Not authorized for this entry';
  end if;
  if v_entry.user_id is distinct from v_uid then
    raise exception 'You can only delete your own entries';
  end if;

  delete from public.time_entries where id = p_entry_id;
end;
$$;

revoke all on function public.start_timer(uuid) from public, anon;
revoke all on function public.stop_timer(uuid, boolean) from public, anon;
revoke all on function public.edit_time_entry(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.delete_time_entry(uuid) from public, anon;
grant execute on function public.start_timer(uuid) to authenticated;
grant execute on function public.stop_timer(uuid, boolean) to authenticated;
grant execute on function public.edit_time_entry(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.delete_time_entry(uuid) to authenticated;
