"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { fileMetaSchema } from "@/lib/schemas";
import { uploadClientFileAction } from "@/lib/actions/storage";

type Result = { ok: true } | { ok: false; error: string };

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}/files`);
  revalidatePath(`/clients/${clientId}`);
}

/** Upload a document: stores the object + records a files row. */
export async function uploadDocumentAction(
  clientId: string,
  formData: FormData,
): Promise<Result> {
  const me = await requireClientAccess(clientId);

  const meta = fileMetaSchema.safeParse({
    category: String(formData.get("category") ?? "other"),
    visible_to_client: formData.get("visible_to_client") === "true",
  });
  if (!meta.success) {
    return { ok: false, error: meta.error.issues[0]?.message ?? "Invalid input" };
  }

  const up = await uploadClientFileAction(clientId, formData);
  if (!up.ok) return { ok: false, error: up.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("files")
    .insert({
      client_id: clientId,
      name: up.name,
      category: meta.data.category,
      storage_path: up.path,
      mime_type: up.mime,
      size_bytes: up.size,
      visible_to_client: meta.data.visible_to_client,
      uploaded_by: me.id,
    })
    .select("id")
    .single();
  if (error) {
    // best-effort cleanup of the orphaned object
    await supabase.storage.from("client-files").remove([up.path]);
    return { ok: false, error: error.message };
  }

  await logAudit({
    actorId: me.id,
    action: "file.uploaded",
    entity: "file",
    entityId: data.id,
    clientId,
    metadata: { name: up.name, category: meta.data.category },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function setFileVisibilityAction(
  clientId: string,
  id: string,
  visible: boolean,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("files")
    .update({ visible_to_client: visible })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "file.visibility_changed",
    entity: "file",
    entityId: id,
    clientId,
    metadata: { visible_to_client: visible },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteFileAction(
  clientId: string,
  id: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("files")
    .select("storage_path, name")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();
  if (row?.storage_path) {
    await supabase.storage.from("client-files").remove([row.storage_path]);
  }

  const { error } = await supabase
    .from("files")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "file.deleted",
    entity: "file",
    entityId: id,
    clientId,
    metadata: { name: row?.name },
  });
  revalidate(clientId);
  return { ok: true };
}
