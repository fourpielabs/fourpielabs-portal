import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { buildValueProof } from "@/lib/value-proof";
import { ValueProofBody } from "@/components/redesign/client/value-proof-body";

/**
 * Client "Results" — the Value Proof outcomes dashboard. The PROJECT-client
 * canonical performance surface (program clients have /performance; we redirect
 * them there to avoid duplication). Read-only: clients never enter or edit KPI
 * values or targets — staff-only entry holds (RLS). ZERO time/hours data — this
 * reads only the program-KPI store (metric_definitions/metric_entries), which is
 * already RLS-scoped to the client + is_active. No time path exists here.
 */
export default async function ClientResultsPage() {
  await requireRole(["client"]);
  const supabase = await createClient();

  const { data: typeRow } = await supabase.from("client_clients").select("client_type").maybeSingle();
  // Program clients have the existing /performance view — don't duplicate.
  if (typeRow?.client_type === "program") redirect("/performance");

  const [{ data: defs }, { data: entries }] = await Promise.all([
    // RLS already scopes to the caller's own client + is_active; explicit for clarity.
    supabase.from("metric_definitions").select("id, key, label, unit, target").eq("is_active", true).order("sort_order"),
    supabase.from("metric_entries").select("definition_id, period, value_numeric, value_text").order("period"),
  ]);

  const data = buildValueProof(
    (defs ?? []).map((d) => ({ id: d.id, key: d.key, label: d.label, unit: d.unit, target: d.target })),
    (entries ?? []).map((e) => ({ definition_id: e.definition_id, period: e.period, value_numeric: e.value_numeric, value_text: e.value_text })),
  );

  return <ValueProofBody data={data} />;
}
