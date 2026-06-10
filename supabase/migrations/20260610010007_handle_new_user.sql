-- =============================================================================
-- 20260610010007_handle_new_user.sql
-- Create a public.profiles row whenever an auth.users row is inserted
-- (spec §3 "trigger on auth.users creates the profiles row").
--
-- role / client_id / full_name come from the invite metadata
-- (raw_user_meta_data), which is ADMIN-controlled at inviteUserByEmail time.
-- This metadata is used ONLY for the one-time profile seed; it is never used
-- for ongoing authorization (RLS reads public.profiles via the app.* helpers,
-- and role/client_id are immutable for non-admins, enforced in migration 4).
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role      public.user_role;
  v_client_id uuid;
begin
  v_role := coalesce(
    nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role,
    'client'
  );
  v_client_id := nullif(new.raw_user_meta_data ->> 'client_id', '')::uuid;

  insert into public.profiles (id, role, full_name, email, avatar_url, client_id)
  values (
    new.id,
    v_role,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    case when v_role = 'client' then v_client_id else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
