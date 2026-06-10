"use server";

import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";

const BUCKET = "client-files";

export type UploadResult =
  | { ok: true; path: string; name: string; size: number; mime: string }
  | { ok: false; error: string };

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

/**
 * Upload a file into the client's storage folder ({clientId}/{uuid}-{name}).
 * Storage RLS (team within assigned clients / admin) is the real gate.
 */
export async function uploadClientFileAction(
  clientId: string,
  formData: FormData,
): Promise<UploadResult> {
  await requireClientAccess(clientId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected." };
  }
  const path = `${clientId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    path,
    name: file.name,
    size: file.size,
    mime: file.type || "application/octet-stream",
  };
}

/**
 * Mint a short-lived signed download URL. The ONLY client-facing download path
 * (clients have no storage RLS policy). Verifies the path is inside the client's
 * folder and that the caller has access to that client.
 */
export async function getSignedUrlAction(
  clientId: string,
  path: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireClientAccess(clientId);
  if (!path.startsWith(`${clientId}/`)) {
    return { ok: false, error: "Path is outside this client's folder." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create link." };
  }
  return { ok: true, url: data.signedUrl };
}
