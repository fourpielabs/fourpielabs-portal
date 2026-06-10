-- =============================================================================
-- 20260610010005_toggle_checklist_item.sql
-- The SINGLE client write path (spec §3). SECURITY DEFINER, lives in `public`
-- because it must be callable as an RPC by the client role. It validates:
--   * caller owns the item (item.client_id = my_client_id())
--   * kind = 'onboarding'
--   * assignee = 'client'
--   * item is visible_to_client
-- and mutates ONLY is_done / done_by / done_at. No other client write exists.
-- =============================================================================

create or replace function public.toggle_checklist_item(item_id uuid)
returns public.checklist_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item   public.checklist_items;
  v_uid    uuid := (select auth.uid());
  v_client uuid := app.my_client_id();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_item from public.checklist_items where id = item_id;
  if not found then
    raise exception 'Checklist item not found';
  end if;

  if v_item.client_id is distinct from v_client then
    raise exception 'Not authorized for this checklist item';
  end if;
  if v_item.kind <> 'onboarding' then
    raise exception 'Only onboarding items can be toggled by the client';
  end if;
  if v_item.assignee <> 'client' then
    raise exception 'Only client-assigned items can be toggled by the client';
  end if;
  if not v_item.visible_to_client then
    raise exception 'This item is not visible to the client';
  end if;

  update public.checklist_items
     set is_done = not v_item.is_done,
         done_by = case when not v_item.is_done then v_uid else null end,
         done_at = case when not v_item.is_done then now() else null end
   where id = item_id
  returning * into v_item;

  return v_item;
end;
$$;

revoke all on function public.toggle_checklist_item(uuid) from public, anon;
grant execute on function public.toggle_checklist_item(uuid) to authenticated;
