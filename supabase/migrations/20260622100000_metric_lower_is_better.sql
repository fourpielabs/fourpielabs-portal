-- 20260622100000_metric_lower_is_better.sql
-- TRACK 2 (/results management) — per-definition lower_is_better flag.
--
-- WHY: a COST KPI (cost per lead / booking) is BETTER when it DROPS. The Value Proof
-- /results read (lib/value-proof.ts) previously inferred "lower is better" from a
-- HARD-CODED key set, so a project client's *custom* cost KPI (any key outside that
-- set) would score a drop as a loss and pace backwards. This makes it a real per-KPI
-- flag staff can set, while value-proof keeps the key set as a fallback (so existing
-- program cost KPIs keep pacing right — one consistent code path: flag OR known key).
--
-- ADDITIVE + NON-DESTRUCTIVE. RLS unchanged: the column inherits the existing
-- metric_definitions policies (admin all / team is_assigned / client select own+active).
-- No new grant/policy. Staff-only write holds (writes go through the existing
-- staff metric-definition actions; clients have no write path to metric_definitions).

alter table public.metric_definitions
  add column if not exists lower_is_better boolean not null default false;

-- Backfill the cost KPIs already in use (mirrors value-proof's LOWER_IS_BETTER set) so
-- materialized program defs + any existing rows are self-consistent. Every other
-- definition stays false — correct for the more-is-better metrics in use today.
update public.metric_definitions
  set lower_is_better = true
  where key in ('cost_per_lead', 'blended_cost_per_lead');
