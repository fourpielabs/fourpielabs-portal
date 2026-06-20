/**
 * Program catalog resolver (P1) — the SINGLE source of truth for a client's
 * resolved program experience. Both the Program tab and the "What's included"
 * card read from this, so they can never disagree.
 *
 * Stacking: the core tiers include the previous (Core ⊂ Pipeline ⊂ Operating
 * System) via `tier_order`. Pulse is PARALLEL (`is_parallel`) — additive, runs
 * standalone or alongside any core tier. "What's not included" DERIVES from the
 * catalog: services on programs the client doesn't have, shown as a gentle
 * "available on {program}" availability signal.
 *
 * RLS-scoped: pass a request-scoped Supabase client. A client user reads only
 * their own `client_programs` rows (RLS); the catalog tables are public-read.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProgramRow = {
  id: string;
  key: string;
  name: string;
  eyebrow: string | null;
  tagline: string | null;
  tier_order: number | null;
  is_parallel: boolean;
};

export type ServiceRow = {
  program_id: string;
  label: string;
  description: string | null;
  category: string;
  sort_order: number;
};

export type ResolvedService = {
  label: string;
  description: string | null;
  category: string;
  programKey: string;
  programName: string;
  tierOrder: number | null;
};

export type ResolvedPrograms = {
  /** the client's assigned program(s) — one core tier and/or Pulse */
  assigned: ProgramRow[];
  /** the full stacked + Pulse included service set, ordered */
  included: ResolvedService[];
  /** services from programs the client lacks, tagged "available on {programName}" */
  notIncluded: ResolvedService[];
  coreTierOrder: number | null;
  hasPulse: boolean;
};

function orderServices(a: ResolvedService, b: ResolvedService) {
  const ta = a.tierOrder ?? 99;
  const tb = b.tierOrder ?? 99;
  if (ta !== tb) return ta - tb;
  return a.label.localeCompare(b.label);
}

/**
 * Resolve a client's full program experience from the catalog.
 *
 * @param fallbackProgramKey  the legacy `clients.program` value — used only if
 *        the client has NO `client_programs` rows yet (defensive; the mirror
 *        trigger normally guarantees a row for every program client).
 */
export async function resolveClientPrograms(
  supabase: SupabaseClient,
  clientId: string,
  fallbackProgramKey?: string | null,
): Promise<ResolvedPrograms> {
  const [{ data: programs }, { data: services }, { data: assignments }] = await Promise.all([
    supabase.from("programs").select("id, key, name, eyebrow, tagline, tier_order, is_parallel").eq("is_active", true),
    supabase.from("program_services").select("program_id, label, description, category, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("client_programs").select("program_id").eq("client_id", clientId),
  ]);

  const allPrograms = (programs ?? []) as ProgramRow[];
  const allServices = (services ?? []) as ServiceRow[];
  const byId = new Map(allPrograms.map((p) => [p.id, p]));

  // assigned program ids (RLS-scoped); fall back to clients.program if none
  let assignedIds = new Set((assignments ?? []).map((a) => a.program_id as string));
  if (assignedIds.size === 0 && fallbackProgramKey) {
    const fb = allPrograms.find((p) => p.key === fallbackProgramKey);
    if (fb) assignedIds = new Set([fb.id]);
  }

  const assigned = allPrograms.filter((p) => assignedIds.has(p.id));
  const coreTierOrder = assigned
    .filter((p) => !p.is_parallel && p.tier_order != null)
    .reduce<number | null>((max, p) => (max == null || (p.tier_order as number) > max ? (p.tier_order as number) : max), null);
  const hasPulse = assigned.some((p) => p.is_parallel);

  // INCLUDED: a core tier at/below the client's tier, or the parallel (Pulse)
  // program when the client is assigned it.
  const isIncluded = (p: ProgramRow) =>
    p.is_parallel ? hasPulse && assignedIds.has(p.id) : coreTierOrder != null && (p.tier_order ?? Infinity) <= coreTierOrder;

  // "AVAILABLE TO ADD": the natural UPGRADE path — higher core tiers than the
  // client's, plus Pulse if not assigned. A Pulse-only client (no core tier) has
  // an EMPTY upgrade path: we never dump the whole core stack on them (clean state,
  // never salesy). Anything that is neither included nor an upgrade is dropped.
  const isUpgrade = (p: ProgramRow) =>
    p.is_parallel ? !hasPulse && coreTierOrder != null : coreTierOrder != null && (p.tier_order ?? 0) > coreTierOrder;

  const toResolved = (s: ServiceRow): ResolvedService => {
    const p = byId.get(s.program_id)!;
    return { label: s.label, description: s.description, category: s.category, programKey: p.key, programName: p.name, tierOrder: p.tier_order };
  };

  const included: ResolvedService[] = [];
  const notIncluded: ResolvedService[] = [];
  for (const s of allServices) {
    const p = byId.get(s.program_id);
    if (!p) continue;
    if (isIncluded(p)) included.push(toResolved(s));
    else if (isUpgrade(p)) notIncluded.push(toResolved(s));
  }
  included.sort(orderServices);
  notIncluded.sort(orderServices);

  return { assigned, included, notIncluded, coreTierOrder, hasPulse };
}
