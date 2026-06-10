"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { reportSchema, type ReportValues } from "@/lib/schemas";

type Result = { ok: true } | { ok: false; error: string };
const txt = (v: string | undefined | null) => (v && v.length > 0 ? v : null);
const revalidate = (clientId: string) =>
  revalidatePath(`/clients/${clientId}/reports`);

function row(v: ReportValues) {
  return {
    title: v.title,
    period_start: txt(v.period_start),
    period_end: txt(v.period_end),
    summary: txt(v.summary),
  };
}

export async function createReportAction(
  clientId: string,
  values: ReportValues,
  pdfPath?: string | null,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = reportSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .insert({
      client_id: clientId,
      created_by: me.id,
      pdf_path: pdfPath ?? null,
      published: false,
      ...row(parsed.data),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "report.created",
    entity: "report",
    entityId: data.id,
    clientId,
    metadata: { title: parsed.data.title },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function updateReportAction(
  clientId: string,
  id: string,
  values: ReportValues,
  pdfPath?: string | null,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = reportSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const patch: Record<string, unknown> = { ...row(parsed.data) };
  if (pdfPath !== undefined) patch.pdf_path = pdfPath;
  const { error } = await supabase
    .from("reports")
    .update(patch)
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "report.updated",
    entity: "report",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

/** Publish / unpublish. Unpublished reports are NEVER visible to clients (RLS). */
export async function setReportPublishedAction(
  clientId: string,
  id: string,
  published: boolean,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({
      published,
      published_at: published ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: published ? "report.published" : "report.unpublished",
    entity: "report",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteReportAction(
  clientId: string,
  id: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("reports")
    .select("pdf_path")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();
  if (r?.pdf_path) {
    await supabase.storage.from("client-files").remove([r.pdf_path]);
  }
  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: "report.deleted",
    entity: "report",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}
