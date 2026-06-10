"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { milestoneSchema, type MilestoneValues } from "@/lib/schemas";

type Result = { ok: true } | { ok: false; error: string };
type Status = "upcoming" | "in_progress" | "done";

const clean = (v: string | undefined | null) => (v && v.length > 0 ? v : null);

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}/program`);
  revalidatePath(`/clients/${clientId}`);
}

export async function createMilestoneAction(
  clientId: string,
  values: MilestoneValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = milestoneSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("milestones")
    .select("sort_order")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("milestones")
    .insert({
      client_id: clientId,
      title: v.title,
      description: clean(v.description),
      phase_label: clean(v.phase_label),
      status: v.status,
      due_date: clean(v.due_date),
      visible_to_client: v.visible_to_client,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "milestone.created",
    entity: "milestone",
    entityId: data.id,
    clientId,
    metadata: { title: v.title },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function updateMilestoneAction(
  clientId: string,
  id: string,
  values: MilestoneValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = milestoneSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("milestones")
    .update({
      title: v.title,
      description: clean(v.description),
      phase_label: clean(v.phase_label),
      status: v.status,
      due_date: clean(v.due_date),
      visible_to_client: v.visible_to_client,
    })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "milestone.updated",
    entity: "milestone",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function setMilestoneStatusAction(
  clientId: string,
  id: string,
  status: Status,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("milestones")
    .update({ status })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "milestone.status_changed",
    entity: "milestone",
    entityId: id,
    clientId,
    metadata: { status },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteMilestoneAction(
  clientId: string,
  id: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("milestones")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "milestone.deleted",
    entity: "milestone",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function moveMilestoneAction(
  clientId: string,
  id: string,
  direction: "up" | "down",
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("milestones")
    .select("id, sort_order")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();
  if (!current) return { ok: false, error: "Milestone not found" };

  let neighborQuery = supabase
    .from("milestones")
    .select("id, sort_order")
    .eq("client_id", clientId);
  neighborQuery =
    direction === "up"
      ? neighborQuery.lt("sort_order", current.sort_order)
      : neighborQuery.gt("sort_order", current.sort_order);
  const { data: neighbor } = await neighborQuery
    .order("sort_order", { ascending: direction === "down" })
    .limit(1)
    .maybeSingle();
  if (!neighbor) return { ok: true };

  await supabase
    .from("milestones")
    .update({ sort_order: neighbor.sort_order })
    .eq("id", current.id)
    .eq("client_id", clientId);
  await supabase
    .from("milestones")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbor.id)
    .eq("client_id", clientId);

  await logAudit({
    actorId: me.id,
    action: "milestone.reordered",
    entity: "milestone",
    entityId: id,
    clientId,
    metadata: { direction },
  });
  revalidate(clientId);
  return { ok: true };
}
