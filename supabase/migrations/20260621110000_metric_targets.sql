-- =============================================================================
-- 20260621110000_metric_targets.sql  (Value Proof dashboard — staff-set targets)
--
-- Adds an optional per-KPI TARGET to metric_definitions for the client-facing
-- "Value Proof" outcomes dashboard's pacing bars ("are we on track?").
--
-- ADDITIVE + NON-DESTRUCTIVE: one nullable column. NO new RLS — the existing
-- metric_definitions policies already enforce the lock:
--   * admin/team (assigned) write  → staff set targets
--   * client SELECT own + is_active → client READS the target, never writes it
--     (there is NO client write policy on metric_definitions; the self-set lock
--      that protects values protects targets identically).
-- Time/hours data is untouched — this is outcomes only.
-- =============================================================================
alter table public.metric_definitions
  add column target numeric;

comment on column public.metric_definitions.target is
  'Optional staff-set goal for this KPI; powers the Value Proof pacing bar. Client-read, staff-write (existing RLS).';
