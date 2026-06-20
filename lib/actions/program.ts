"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { programSchema, type ProgramValues } from "@/lib/schemas";

type Result = { ok: true } | { ok: false; error: string };

export type CoreTier = "foundation" | "pipeline" | "operating_system" | null;
const CORE_TIERS = ["foundation", "pipeline", "operating_system"] as const;

/**
 * Staff-only: set a client's program assignment — exactly one CORE tier (or none)
 * plus an optional PULSE add-on. Writes go through the user-scoped client, so the
 * cprog_admin_all / cprog_team_all RLS policies enforce staff-only (clients have
 * NO write path — the self-assign lock holds). The existing triggers then re-run
 * sync, so services AND the KPI set re-resolve automatically.
 *
 * Reconciliation with the legacy clients.program (extend-not-replace, NOT NULL):
 * it is set to the assigned CORE tier, or 'pulse' when Pulse-only — so anything
 * still reading the old field gets a sensible value and never drifts. The P1
 * mirror trigger maintains the core client_programs row from this field (and
 * preserves the parallel Pulse row); this action additionally manages the Pulse
 * row and clears core rows for the Pulse-only case.
 */
export async function setClientProgramsAction(
  clientId: string,
  coreTier: CoreTier,
  pulse: boolean,
): Promise<Result> {
  const me = await requireClientAccess(clientId);

  if (coreTier !== null && !CORE_TIERS.includes(coreTier))
    return { ok: false, error: "Invalid core tier" };
  if (!coreTier && !pulse)
    return { ok: false, error: "Assign a core tier or Pulse — a program client needs at least one program." };

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("client_type").eq("id", clientId).single();
  if (!client) return { ok: false, error: "Client not found" };
  if (client.client_type !== "program")
    return { ok: false, error: "Only program clients have a program assignment." };

  const { data: pulseProg } = await supabase.from("programs").select("id").eq("key", "pulse").single();
  if (!pulseProg) return { ok: false, error: "Program catalog not found" };

  // 1) reconcile the legacy field: core tier if present, else 'pulse' (Pulse-only).
  //    Fires the mirror trigger → maintains the core client_programs row.
  const newProgram = coreTier ?? "pulse";
  const { error: cErr } = await supabase.from("clients").update({ program: newProgram }).eq("id", clientId);
  if (cErr) return { ok: false, error: cErr.message };

  // 2) Pulse-only: clear any core-tier assignment the mirror trigger left in place.
  if (!coreTier) {
    const { error } = await supabase.from("client_programs").delete().eq("client_id", clientId).eq("is_parallel", false);
    if (error) return { ok: false, error: error.message };
  }

  // 3) Pulse add-on (direct staff write; RLS staff-only).
  if (pulse) {
    const { error } = await supabase
      .from("client_programs")
      .upsert({ client_id: clientId, program_id: pulseProg.id, assigned_by: me.id }, { onConflict: "client_id,program_id", ignoreDuplicates: true });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("client_programs").delete().eq("client_id", clientId).eq("program_id", pulseProg.id);
    if (error) return { ok: false, error: error.message };
  }

  await logAudit({
    actorId: me.id,
    action: "program.assignment_changed",
    entity: "client",
    entityId: clientId,
    clientId,
    metadata: { coreTier, pulse, program: newProgram },
  });
  revalidatePath(`/clients/${clientId}/program`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/metrics`);
  return { ok: true };
}

const clean = (v: string | undefined | null) => (v && v.length > 0 ? v : null);

export async function updateProgramAction(
  values: ProgramValues,
): Promise<Result> {
  const me = await requireClientAccess(values.id);
  const parsed = programSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({
      service_type: clean(v.service_type),
      investment: clean(v.investment),
      start_date: clean(v.start_date),
      end_date: clean(v.end_date),
      comms_channel: clean(v.comms_channel),
      best_way_to_reach: clean(v.best_way_to_reach),
      response_time: clean(v.response_time),
      call_scheduling_note: clean(v.call_scheduling_note),
      revision_policy: clean(v.revision_policy),
      whats_included: clean(v.whats_included),
      whats_not_included: clean(v.whats_not_included),
    })
    .eq("id", v.id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "program.updated",
    entity: "client",
    entityId: v.id,
    clientId: v.id,
  });
  revalidatePath(`/clients/${v.id}/program`);
  revalidatePath(`/clients/${v.id}`);
  return { ok: true };
}
