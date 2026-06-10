-- =============================================================================
-- 20260610010003_rls_helpers.sql
-- RLS helper functions (spec §4 "RLS helpers").
--
-- Kept in a PRIVATE schema `app` (NOT in the exposed `public` schema) so they
-- are not reachable through the Data API, per Supabase security guidance for
-- SECURITY DEFINER functions. They remain callable from RLS policies.
--
-- SECURITY DEFINER + `set search_path = ''` means they run with the definer's
-- privileges and bypass RLS on public.profiles / public.client_assignments —
-- which is what prevents infinite recursion when used inside profiles policies.
-- =============================================================================

create schema if not exists app;
grant usage on schema app to authenticated, anon, service_role;

-- Is the current user an active admin?
create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active
  );
$$;

-- Is the current user an active team member?
create or replace function app.is_team()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'team'
      and is_active
  );
$$;

-- The client_id of the current user (null for admin/team).
create or replace function app.my_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select client_id
  from public.profiles
  where id = (select auth.uid());
$$;

-- Is the current user assigned to client `cid`? (team scoping)
create or replace function app.is_assigned(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.client_assignments
    where user_id = (select auth.uid())
      and client_id = cid
  );
$$;

grant execute on function
    app.is_admin(),
    app.is_team(),
    app.my_client_id(),
    app.is_assigned(uuid)
  to authenticated, anon, service_role;
