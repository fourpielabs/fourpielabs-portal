-- =============================================================================
-- 20260615161921_client_deliverable_approval.sql
--
-- The SECOND (and only other) client write path, after toggle_checklist_item.
-- Adds a single client-writable field `deliverables.client_approved_at` and a
-- SECURITY DEFINER RPC that is the ONLY way a client may set it.
--
-- Design (mirrors public.toggle_checklist_item):
--   * No direct client UPDATE policy is added on public.deliverables — the
--     standing invariant "no direct client UPDATE policy exists on any table"
--     holds. RLS can't restrict WHICH columns change, so the tight scope lives
--     in this DEFINER function instead of a policy + column-guard trigger.
--   * The function validates: authenticated, caller is a CLIENT, the deliverable
--     belongs to the caller's own client, and it is visible_to_client — then it
--     mutates ONLY client_approved_at. admin/team get my_client_id() = null and
--     are rejected, so this is strictly a client path.
--   * app.my_client_id() lives in the private `app` schema (P1) and is called
--     schema-qualified, so it resolves under `set search_path = ''`.
-- =============================================================================

alter table public.deliverables
  add column client_approved_at timestamptz;

create or replace function public.set_deliverable_approval(
  deliverable_id uuid,
  approved boolean
)
returns public.deliverables
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row    public.deliverables;
  v_uid    uuid := (select auth.uid());
  v_client uuid := app.my_client_id();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_client is null then
    raise exception 'Only clients can approve deliverables';
  end if;

  select * into v_row from public.deliverables where id = deliverable_id;
  if not found then
    raise exception 'Deliverable not found';
  end if;
  if v_row.client_id is distinct from v_client then
    raise exception 'Not authorized for this deliverable';
  end if;
  if not v_row.visible_to_client then
    raise exception 'This deliverable is not visible to the client';
  end if;

  -- mutate ONLY the approval field
  update public.deliverables
     set client_approved_at = case when approved then now() else null end
   where id = deliverable_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_deliverable_approval(uuid, boolean) from public, anon;
grant execute on function public.set_deliverable_approval(uuid, boolean) to authenticated;
