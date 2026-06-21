"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import type { IntakeAnswers, IntakeAsset } from "@/lib/intake/config";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const BUCKET = "client-files";
const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";

// ===========================================================================
// Intake — clients write ONLY via the SECURITY DEFINER RPCs (save_intake /
// submit_intake), own-client + project-type-gated. Asset upload mirrors the
// message-attachment pattern: verify the client (RLS-scoped read) then upload
// with the service role (clients have no storage/files write policy). No
// credentials are ever stored — assets are files only.
// ===========================================================================

async function projectClient() {
  const profile = await requireProfile();
  if (profile.role !== "client" || !profile.client_id) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("client_clients").select("client_type").maybeSingle();
  if (data?.client_type !== "project") return null;
  return { profile, clientId: profile.client_id };
}

export async function saveIntakeAction(input: {
  service: string | null;
  answers: IntakeAnswers;
  estimateMin: number | null;
  estimateMax: number | null;
  currentStep: number;
}): Promise<Result> {
  const ctx = await projectClient();
  if (!ctx) return { ok: false, error: "Intake is available to project clients only." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_intake", {
    p_service: input.service,
    p_answers: input.answers,
    p_estimate_min: input.estimateMin,
    p_estimate_max: input.estimateMax,
    p_current_step: input.currentStep,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function uploadIntakeAssetAction(formData: FormData): Promise<Result<IntakeAsset>> {
  const ctx = await projectClient();
  if (!ctx) return { ok: false, error: "Intake is available to project clients only." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file selected." };
  if (file.size > 25 * 1024 * 1024) return { ok: false, error: "File is too large (max 25 MB)." };

  // service role for both the storage upload AND the files row (clients have no
  // write policy on either — the verified-client-then-service-role pattern).
  const admin = createAdminClient();
  const path = `${ctx.clientId}/intake/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (upErr) return { ok: false, error: upErr.message };
  await admin.from("files").insert({
    client_id: ctx.clientId,
    name: file.name,
    category: "brand_asset",
    storage_path: path,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    visible_to_client: true,
    uploaded_by: ctx.profile.id,
  });
  await logAudit({ actorId: ctx.profile.id, action: "intake.asset_uploaded", entity: "file", clientId: ctx.clientId, metadata: { name: file.name } });
  return { ok: true, data: { name: file.name, path } };
}

export async function submitIntakeAction(input: {
  service: string | null;
  answers: IntakeAnswers;
  estimateMin: number | null;
  estimateMax: number | null;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  targetDate: string | null;
  missingAssets: string[];
}): Promise<Result<{ projectId: string }>> {
  const ctx = await projectClient();
  if (!ctx) return { ok: false, error: "Intake is available to project clients only." };
  if (!input.title.trim()) return { ok: false, error: "Project name is required." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_intake", {
    p_service: input.service,
    p_answers: input.answers,
    p_estimate_min: input.estimateMin,
    p_estimate_max: input.estimateMax,
    p_title: input.title,
    p_description: input.description,
    p_priority: input.priority,
    p_target_date: input.targetDate,
    p_missing_assets: input.missingAssets,
  });
  if (error) return { ok: false, error: error.message };
  const projectId = data as unknown as string;
  await logAudit({ actorId: ctx.profile.id, action: "intake.submitted", entity: "project", entityId: projectId, clientId: ctx.clientId, metadata: { service: input.service } });
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  return { ok: true, data: { projectId } };
}
