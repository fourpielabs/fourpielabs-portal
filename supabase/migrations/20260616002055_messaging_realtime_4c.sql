-- =============================================================================
-- 20260616002055_messaging_realtime_4c.sql
--
-- Phase 4c — enable Supabase Realtime (postgres_changes) for messaging + the bell.
-- PUBLICATION MEMBERSHIP ONLY — NOT an RLS or table change. RLS policies are
-- untouched (test:rls stays 159). Realtime postgres_changes honors the existing
-- RLS per subscriber, so a client only ever receives rows it may SELECT (its own
-- client_shared thread) — internal-thread rows are RLS-denied at the realtime layer.
--
-- Only INSERT events are consumed (new messages / notifications), so the default
-- replica identity is sufficient (no replica-identity change needed).
-- =============================================================================

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
