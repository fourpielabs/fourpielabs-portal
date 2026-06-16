"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth/guards";

const BUCKET = "client-files";
const MAX_BYTES = 25 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

type UploadResult = { ok: true; path: string; name: string } | { ok: false; error: string };
type UrlResult = { ok: true; url: string; name: string } | { ok: false; error: string };

/**
 * Upload a message attachment. AUTHORIZATION = an RLS-scoped read of the THREAD —
 * a client reading an internal thread gets nothing (threads_client_select is
 * shared-only) → denied. The storage write itself goes through the SERVICE ROLE
 * (clients have no storage.objects policy — the standing rule); the file lands in
 * the client's folder. Access on the way OUT is re-checked against the message
 * (getMessageAttachmentUrlAction). No new bucket, no new storage policy.
 */
export async function uploadMessageAttachmentAction(
  threadId: string,
  formData: FormData,
): Promise<UploadResult> {
  await requireProfile();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file selected." };
  if (file.size > MAX_BYTES) return { ok: false, error: "File is too large (max 25 MB)." };

  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("threads")
    .select("client_id")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return { ok: false, error: "Thread not found or not accessible." };

  const path = `${thread.client_id}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path, name: file.name };
}

/**
 * Mint a short-lived signed URL for a message's attachment. The RLS-scoped READ of
 * the MESSAGE is the authorization: a client reading an INTERNAL message gets
 * nothing (messages_client_select is shared-only) → DENIED, so a client can never
 * fetch an internal-thread attachment (the boundary's sixth surface). Only after
 * that read succeeds does the service role sign the URL (clients lack storage RLS).
 */
export async function getMessageAttachmentUrlAction(messageId: string): Promise<UrlResult> {
  await requireProfile();
  const supabase = await createClient();
  const { data: msg } = await supabase
    .from("messages")
    .select("attachment_path, attachment_name")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg || !msg.attachment_path) return { ok: false, error: "Attachment not found." };

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(msg.attachment_path as string, 60);
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create link." };
  return { ok: true, url: data.signedUrl, name: (msg.attachment_name as string) ?? "file" };
}
