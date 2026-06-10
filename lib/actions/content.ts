"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { contentItemSchema, type ContentItemValues } from "@/lib/schemas";

type Result = { ok: true } | { ok: false; error: string };
type Status =
  | "idea"
  | "drafting"
  | "in_review"
  | "approved"
  | "scheduled"
  | "published";

const txt = (v: string | undefined | null) => (v && v.length > 0 ? v : null);
const num = (v: string | undefined) => {
  if (!v || v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
const revalidate = (clientId: string) => {
  revalidatePath(`/clients/${clientId}/content`);
  revalidatePath(`/clients/${clientId}`);
};

function toRow(v: ContentItemValues) {
  return {
    title: v.title,
    platform: v.platform,
    content_type: txt(v.content_type),
    status: v.status,
    publish_date: txt(v.publish_date),
    cta: txt(v.cta),
    core_message: txt(v.core_message),
    notes: txt(v.notes),
    asset_url: txt(v.asset_url),
    views_after_posting: num(v.views_after_posting),
    visible_to_client: v.visible_to_client,
  };
}

export async function createContentItemAction(
  clientId: string,
  values: ContentItemValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = contentItemSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_items")
    .insert({ client_id: clientId, created_by: me.id, ...toRow(parsed.data) })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "content_item.created",
    entity: "content_item",
    entityId: data.id,
    clientId,
    metadata: { title: parsed.data.title, platform: parsed.data.platform },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function updateContentItemAction(
  clientId: string,
  id: string,
  values: ContentItemValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = contentItemSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "content_item.updated",
    entity: "content_item",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function setContentStatusAction(
  clientId: string,
  id: string,
  status: Status,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ status })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "content_item.status_changed",
    entity: "content_item",
    entityId: id,
    clientId,
    metadata: { status },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function setContentVisibilityAction(
  clientId: string,
  id: string,
  visible: boolean,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ visible_to_client: visible })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "content_item.visibility_changed",
    entity: "content_item",
    entityId: id,
    clientId,
    metadata: { visible_to_client: visible },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteContentItemAction(
  clientId: string,
  id: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "content_item.deleted",
    entity: "content_item",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}
