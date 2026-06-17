-- Lock task status to staff.
--
-- Mirror of the project-status lock (20260617183715_lock_project_status_to_staff):
-- clients must NOT change a task's status. The client status path was a dedicated
-- status-only SECURITY DEFINER RPC, update_task_status(p_task_id, p_status), whose
-- ONLY purpose was to let a client set status. So the lock is to DROP it outright
-- (unlike projects, there is no client title/description edit to preserve — clients
-- set title/description only at creation via create_task).
--
-- After this migration a client has ZERO status-write path:
--   * the RPC is gone (calling it errors), and
--   * tasks has NO client INSERT/UPDATE policy (only tasks_client_select, read-only),
--     so a direct UPDATE of tasks.status is RLS-denied (42501).
-- create_task is UNCHANGED — it hard-codes status='todo', so clients still CREATE
-- tasks. Staff status control is UNTOUCHED: staff set status via DIRECT table writes
-- (lib/actions/tasks.ts) under the tasks_admin_all / tasks_team_all for-all policies;
-- they never used this RPC. Dropping the function also drops its grants.

drop function if exists public.update_task_status(uuid, public.task_status);
