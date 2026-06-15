-- =============================================================================
-- 20260615225734_communication_4a_fix_can_access.sql
--
-- SECURITY FIX for app.can_access_thread (from 4a). Three-valued-logic bug:
-- for an UNASSIGNED team member my_client_id() is NULL, so the client clause
-- `p_client_id = app.my_client_id()` evaluates to NULL (not false), making the
-- whole expression `false OR false OR NULL` = NULL. In post_message /
-- mark_thread_read, `if not NULL then raise` does NOT fire — so an unassigned
-- team member could post to / mark-read ANY client's thread. Wrap the result in
-- coalesce(..., false) so a NULL (no matching clause) is a hard deny.
-- (Admin/assigned-team/client/anon were already correct; only the NULL path leaked.)
-- =============================================================================

create or replace function app.can_access_thread(p_client_id uuid, p_type public.thread_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
       app.is_admin()
    or (app.is_team() and app.is_assigned(p_client_id))
    or (p_type = 'client_shared' and p_client_id = app.my_client_id()),
    false
  );
$$;
-- grants unchanged (authenticated only); create-or-replace preserves them.
