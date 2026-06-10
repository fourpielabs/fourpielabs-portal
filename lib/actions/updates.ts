"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { updateSchema, type UpdateValues } from "@/lib/schemas";
import { type Profile } from "@/lib/auth/guards";

type Result = { ok: true } | { ok: false; error: string };

const clean = (v: string | undefined | null) => (v && v.length > 0 ? v : null);

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}/updates`);
  revalidatePath(`/clients/${clientId}`);
}

// edit/delete/pin/visibility are limited to the author or an admin
async function assertOwnerOrAdmin(
  me: Profile,
  clientId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (me.role === "admin") return { ok: true };
  const supabase = await createClient();
  const { data } = await supabase
    .from("updates")
    .select("author_id")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();
  if (!data) return { ok: false, error: "Update not found" };
  if (data.author_id !== me.id) {
    return { ok: false, error: "You can only edit your own updates." };
  }
  return { ok: true };
}

export async function createUpdateAction(
  clientId: string,
  values: UpdateValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = updateSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("updates")
    .insert({
      client_id: clientId,
      author_id: me.id,
      title: v.title,
      body: clean(v.body),
      pinned: v.pinned,
      visible_to_client: v.visible_to_client,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "update.created",
    entity: "update",
    entityId: data.id,
    clientId,
    metadata: { title: v.title },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function updateUpdateAction(
  clientId: string,
  id: string,
  values: UpdateValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const owns = await assertOwnerOrAdmin(me, clientId, id);
  if (!owns.ok) return owns;
  const parsed = updateSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("updates")
    .update({
      title: v.title,
      body: clean(v.body),
      pinned: v.pinned,
      visible_to_client: v.visible_to_client,
    })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "update.updated",
    entity: "update",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteUpdateAction(
  clientId: string,
  id: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const owns = await assertOwnerOrAdmin(me, clientId, id);
  if (!owns.ok) return owns;
  const supabase = await createClient();
  const { error } = await supabase
    .from("updates")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "update.deleted",
    entity: "update",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function setUpdateFlagsAction(
  clientId: string,
  id: string,
  flags: { pinned?: boolean; visible_to_client?: boolean },
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const owns = await assertOwnerOrAdmin(me, clientId, id);
  if (!owns.ok) return owns;
  const supabase = await createClient();
  const { error } = await supabase
    .from("updates")
    .update(flags)
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "update.flags_changed",
    entity: "update",
    entityId: id,
    clientId,
    metadata: flags,
  });
  revalidate(clientId);
  return { ok: true };
}
