-- =============================================================================
-- 20260623140000_message_reactions_soft_delete_mirror.sql  — Track 5 S3 follow-up
--
-- Complete the message_reactions ⇄ messages visibility MIRROR. The messages SELECT
-- policies were narrowed to "... and deleted_at is null" (20260616191150) so a
-- soft-deleted message vanishes from every read. The reaction policies only checked
-- the denormalized client_id/thread_type, so a reaction on a soft-deleted message
-- stayed readable/countable (and getThreadReactionsAction would resolve reactor names
-- for a message the caller can no longer see). Not a cross-boundary leak — toggle_reaction
-- already blocks reacting to a deleted message and the realtime path never surfaces it —
-- but it diverges from the claimed mirror and ships dead data. Add the parent's
-- deleted_at-is-null check to all three SELECT policies so a reaction is visible IFF its
-- message is. (message_reactions is NOT in supabase_realtime, so an EXISTS subquery in its
-- SELECT policy is fine — the DELETE-event RLS caveat only applies to published tables.)
-- =============================================================================

alter policy "reactions_admin_select" on public.message_reactions
  using (app.is_admin()
    and exists (select 1 from public.messages m where m.id = message_id and m.deleted_at is null));

alter policy "reactions_team_select" on public.message_reactions
  using (app.is_assigned(client_id)
    and exists (select 1 from public.messages m where m.id = message_id and m.deleted_at is null));

alter policy "reactions_client_select" on public.message_reactions
  using (client_id = app.my_client_id() and thread_type = 'client_shared'
    and exists (select 1 from public.messages m where m.id = message_id and m.deleted_at is null));
