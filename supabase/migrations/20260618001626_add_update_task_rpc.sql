-- Client task title/description edit (Phase 2 — task detail view).
--
-- The deferred bit from the task-status lock: clients may now edit their OWN task's
-- TITLE + DESCRIPTION (the detail view's only client write) — but NOT status, assignee,
-- due_date, or visible_to_client (all staff-only). Like every client write, this goes
-- through a SECURITY DEFINER RPC validating own-client scope; there is still NO direct
-- client INSERT/UPDATE policy on tasks.
--
-- Escalation is structurally impossible: the function takes ONLY (p_task_id, p_title,
-- p_description) and its UPDATE sets ONLY title + description — there is no parameter or
-- column path to status/assignee_id/due_date/visible_to_client. Scope mirrors the dropped
-- update_task_status verbatim: own-client AND visible_to_client (an internal/staff-only or
-- cross-client task is untouchable). create_task + update_task_status (dropped) are
-- unchanged; staff edit via direct table writes (lib/actions/tasks.ts), untouched.

create or replace function public.update_task(
  p_task_id uuid,
  p_title text,
  p_description text
)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_client uuid := app.my_client_id();
  v_row    public.tasks;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  if v_client is null then
    raise exception 'Only clients can update tasks here';
  end if;

  select * into v_row from public.tasks where id = p_task_id;
  if not found then
    raise exception 'Task not found';
  end if;

  -- own-client AND visible gate (verbatim from the dropped update_task_status):
  -- internal/staff-only (visible_to_client=false) and cross-client tasks are untouchable.
  if v_row.client_id is distinct from v_client or not v_row.visible_to_client then
    raise exception 'Not authorized for this task';
  end if;

  if coalesce(btrim(p_title), '') = '' then
    raise exception 'Title is required';
  end if;

  -- title + description ONLY. status / assignee_id / due_date / visible_to_client are
  -- deliberately NOT in the SET clause — a client can never reach them through this path.
  update public.tasks
     set title = btrim(p_title),
         description = nullif(btrim(p_description), '')
   where id = p_task_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_task(uuid, text, text) from public, anon;
grant execute on function public.update_task(uuid, text, text) to authenticated;
