-- =============================================================================
-- 20260611120000_revoke_trigger_fn_execute.sql
-- Security advisor fix (SEC-3): trigger functions are invoked by triggers, never
-- via the API. They were reachable through PostgREST /rest/v1/rpc/<fn> for the
-- anon + authenticated roles. Revoke EXECUTE so they can't be called directly.
-- Triggers fire regardless of EXECUTE grants, so behavior is unchanged.
--
-- Clears advisors:
--   anon_security_definer_function_executable (handle_new_user, seed_new_client,
--     enforce_profile_self_update)
--   authenticated_security_definer_function_executable (same three)
--
-- toggle_checklist_item stays executable by `authenticated` BY DESIGN (it's the
-- single client write path / RPC) — that advisor warning is accepted, not fixed.
-- The app.* helper functions are unaffected (they live in the non-exposed `app`
-- schema, so the advisor never flagged them).
-- =============================================================================

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.seed_new_client() from public, anon, authenticated;
revoke all on function public.enforce_profile_self_update() from public, anon, authenticated;
