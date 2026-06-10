"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { competitorSchema, type CompetitorValues } from "@/lib/schemas";

type Result = { ok: true } | { ok: false; error: string };

const txt = (v: string | undefined | null) => (v && v.length > 0 ? v : null);
const num = (v: string | undefined) => {
  if (!v || v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}/competitors`);
}

function toRow(v: CompetitorValues) {
  return {
    name_or_handle: v.name_or_handle,
    niche: txt(v.niche),
    follower_count: num(v.follower_count),
    avg_views: num(v.avg_views),
    top_content_format: txt(v.top_content_format),
    hook_style: txt(v.hook_style),
    whats_working: txt(v.whats_working),
    gap_notes: txt(v.gap_notes),
    adapted_idea: txt(v.adapted_idea),
    priority: v.priority,
    visible_to_client: v.visible_to_client,
  };
}

export async function createCompetitorAction(
  clientId: string,
  values: CompetitorValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = competitorSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitors")
    .insert({ client_id: clientId, ...toRow(parsed.data) })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "competitor.created",
    entity: "competitor",
    entityId: data.id,
    clientId,
    metadata: { name: parsed.data.name_or_handle },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function updateCompetitorAction(
  clientId: string,
  id: string,
  values: CompetitorValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = competitorSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("competitors")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "competitor.updated",
    entity: "competitor",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function setCompetitorVisibilityAction(
  clientId: string,
  id: string,
  visible: boolean,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("competitors")
    .update({ visible_to_client: visible })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "competitor.visibility_changed",
    entity: "competitor",
    entityId: id,
    clientId,
    metadata: { visible_to_client: visible },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteCompetitorAction(
  clientId: string,
  id: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("competitors")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "competitor.deleted",
    entity: "competitor",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}
