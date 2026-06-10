"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { checklistItemSchema, type ChecklistItemValues } from "@/lib/schemas";

type Result = { ok: true } | { ok: false; error: string };
type Kind = "onboarding" | "offboarding";

function clean(v: string | undefined | null) {
  return v && v.length > 0 ? v : null;
}

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}/checklist`);
  revalidatePath(`/clients/${clientId}`);
}

export async function createChecklistItemAction(
  clientId: string,
  kind: Kind,
  values: ChecklistItemValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = checklistItemSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("checklist_items")
    .select("sort_order")
    .eq("client_id", clientId)
    .eq("kind", kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (last?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("checklist_items")
    .insert({
      client_id: clientId,
      kind,
      phase_label: clean(v.phase_label),
      title: v.title,
      link_url: clean(v.link_url),
      assignee: v.assignee,
      visible_to_client: v.visible_to_client,
      sort_order,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "checklist_item.created",
    entity: "checklist_item",
    entityId: data.id,
    clientId,
    metadata: { kind, title: v.title },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function updateChecklistItemAction(
  clientId: string,
  id: string,
  values: ChecklistItemValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = checklistItemSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("checklist_items")
    .update({
      phase_label: clean(v.phase_label),
      title: v.title,
      link_url: clean(v.link_url),
      assignee: v.assignee,
      visible_to_client: v.visible_to_client,
    })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "checklist_item.updated",
    entity: "checklist_item",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteChecklistItemAction(
  clientId: string,
  id: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "checklist_item.deleted",
    entity: "checklist_item",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function toggleChecklistDoneAction(
  clientId: string,
  id: string,
  isDone: boolean,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_items")
    .update({
      is_done: isDone,
      done_by: isDone ? me.id : null,
      done_at: isDone ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: isDone ? "checklist_item.completed" : "checklist_item.reopened",
    entity: "checklist_item",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function setChecklistVisibleAction(
  clientId: string,
  id: string,
  visible: boolean,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_items")
    .update({ visible_to_client: visible })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "checklist_item.visibility_changed",
    entity: "checklist_item",
    entityId: id,
    clientId,
    metadata: { visible_to_client: visible },
  });
  revalidate(clientId);
  return { ok: true };
}

/** Swap sort_order with the adjacent item in the same client + kind. */
export async function moveChecklistItemAction(
  clientId: string,
  id: string,
  direction: "up" | "down",
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("checklist_items")
    .select("id, sort_order, kind")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();
  if (!current) return { ok: false, error: "Item not found" };

  let neighborQuery = supabase
    .from("checklist_items")
    .select("id, sort_order")
    .eq("client_id", clientId)
    .eq("kind", current.kind);
  neighborQuery =
    direction === "up"
      ? neighborQuery.lt("sort_order", current.sort_order)
      : neighborQuery.gt("sort_order", current.sort_order);
  const { data: neighbor } = await neighborQuery
    .order("sort_order", { ascending: direction === "down" })
    .limit(1)
    .maybeSingle();
  if (!neighbor) return { ok: true }; // already at the edge

  await supabase
    .from("checklist_items")
    .update({ sort_order: neighbor.sort_order })
    .eq("id", current.id)
    .eq("client_id", clientId);
  await supabase
    .from("checklist_items")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbor.id)
    .eq("client_id", clientId);

  await logAudit({
    actorId: me.id,
    action: "checklist_item.reordered",
    entity: "checklist_item",
    entityId: id,
    clientId,
    metadata: { direction },
  });
  revalidate(clientId);
  return { ok: true };
}
