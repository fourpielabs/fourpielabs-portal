"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { programSchema, type ProgramValues } from "@/lib/schemas";

type Result = { ok: true } | { ok: false; error: string };

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
