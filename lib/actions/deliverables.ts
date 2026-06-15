"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess, requireProfile } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { deliverableSchema, type DeliverableValues } from "@/lib/schemas";

type Result = { ok: true } | { ok: false; error: string };
type Status = "pending" | "in_progress" | "needs_review" | "delivered";

const clean = (v: string | undefined | null) => (v && v.length > 0 ? v : null);

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}/deliverables`);
  revalidatePath(`/clients/${clientId}/projects`);
  revalidatePath(`/clients/${clientId}`);
}

const INVALID_PROJECT = Symbol("invalid-project");

/**
 * Resolve + validate a deliverable's project_id. "" / null / undefined → null
 * (unlinked). A uuid must reference a project of THIS SAME client — otherwise
 * returns INVALID_PROJECT (defense-in-depth: RLS checks the deliverable's
 * client_id but not that the linked project shares it).
 */
async function resolveProjectId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  raw: string | null | undefined,
): Promise<string | null | typeof INVALID_PROJECT> {
  const id = clean(raw);
  if (!id) return null;
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("client_id", clientId)
    .maybeSingle();
  return data ? id : INVALID_PROJECT;
}

export async function createDeliverableAction(
  clientId: string,
  values: DeliverableValues,
  filePath?: string | null,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = deliverableSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const projectId = await resolveProjectId(supabase, clientId, v.project_id);
  if (projectId === INVALID_PROJECT) {
    return { ok: false, error: "That project doesn't belong to this client." };
  }

  const { data, error } = await supabase
    .from("deliverables")
    .insert({
      client_id: clientId,
      title: v.title,
      description: clean(v.description),
      type: v.type,
      status: v.status,
      due_date: clean(v.due_date),
      preview_url: clean(v.preview_url),
      project_id: projectId,
      file_path: filePath ?? null,
      visible_to_client: v.visible_to_client,
      delivered_at: v.status === "delivered" ? new Date().toISOString() : null,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "deliverable.created",
    entity: "deliverable",
    entityId: data.id,
    clientId,
    metadata: { title: v.title, status: v.status },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function updateDeliverableAction(
  clientId: string,
  id: string,
  values: DeliverableValues,
  filePath?: string | null,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = deliverableSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("deliverables")
    .select("delivered_at")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();

  const delivered_at =
    v.status === "delivered"
      ? (current?.delivered_at ?? new Date().toISOString())
      : null;

  const projectId = await resolveProjectId(supabase, clientId, v.project_id);
  if (projectId === INVALID_PROJECT) {
    return { ok: false, error: "That project doesn't belong to this client." };
  }

  const patch: Record<string, unknown> = {
    title: v.title,
    description: clean(v.description),
    type: v.type,
    status: v.status,
    due_date: clean(v.due_date),
    preview_url: clean(v.preview_url),
    project_id: projectId,
    visible_to_client: v.visible_to_client,
    delivered_at,
  };
  // filePath: undefined = leave as-is; null = clear; string = set
  if (filePath !== undefined) patch.file_path = filePath;

  const { error } = await supabase
    .from("deliverables")
    .update(patch)
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "deliverable.updated",
    entity: "deliverable",
    entityId: id,
    clientId,
    metadata: { status: v.status },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function setDeliverableStatusAction(
  clientId: string,
  id: string,
  status: Status,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("deliverables")
    .select("delivered_at")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();
  const delivered_at =
    status === "delivered"
      ? (current?.delivered_at ?? new Date().toISOString())
      : null;

  const { error } = await supabase
    .from("deliverables")
    .update({ status, delivered_at })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "deliverable.status_changed",
    entity: "deliverable",
    entityId: id,
    clientId,
    metadata: { status },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function setDeliverableVisibilityAction(
  clientId: string,
  id: string,
  visible: boolean,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("deliverables")
    .update({ visible_to_client: visible })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "deliverable.visibility_changed",
    entity: "deliverable",
    entityId: id,
    clientId,
    metadata: { visible_to_client: visible },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteDeliverableAction(
  clientId: string,
  id: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("deliverables")
    .select("file_path")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();
  if (row?.file_path) {
    await supabase.storage.from("client-files").remove([row.file_path]);
  }

  const { error } = await supabase
    .from("deliverables")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "deliverable.deleted",
    entity: "deliverable",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

/**
 * CLIENT-ONLY write path: approve / un-approve a deliverable. Calls the
 * SECURITY DEFINER RPC `set_deliverable_approval`, which enforces (own client +
 * visible + only the client_approved_at column). The client has NO direct UPDATE
 * policy on deliverables — this RPC is the sole approval mechanism.
 */
export async function setDeliverableApprovalAction(
  deliverableId: string,
  approved: boolean,
): Promise<Result> {
  const me = await requireProfile();
  if (me.role !== "client" || !me.client_id) {
    return { ok: false, error: "Not allowed" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_deliverable_approval", {
    deliverable_id: deliverableId,
    approved,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "deliverable.client_approved",
    entity: "deliverable",
    entityId: deliverableId,
    clientId: me.client_id,
    metadata: { approved },
  });
  revalidatePath("/deliverables");
  revalidatePath("/dashboard");
  return { ok: true };
}
