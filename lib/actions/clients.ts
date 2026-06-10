"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import {
  clientCreateSchema,
  clientUpdateSchema,
  type ClientCreateValues,
  type ClientUpdateValues,
} from "@/lib/schemas";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const STATUSES = ["onboarding", "active", "paused", "churned"] as const;
type ClientStatus = (typeof STATUSES)[number];

function clean(v: string | undefined | null) {
  return v && v.length > 0 ? v : null;
}

/** Create a client. The DB AFTER INSERT trigger seeds checklist, milestones,
 * and program-specific metric definitions automatically. Admin only. */
export async function createClientAction(
  input: ClientCreateValues,
): Promise<Result<{ id: string }>> {
  const admin = await requireRole(["admin"]);
  const parsed = clientCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: v.name,
      slug: v.slug,
      industry: v.industry,
      program: v.program,
      status: v.status,
      website_url: clean(v.website_url),
      start_date: clean(v.start_date),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `Slug "${v.slug}" is already taken.` };
    }
    return { ok: false, error: error.message };
  }

  await logAudit({
    actorId: admin.id,
    action: "client.created",
    entity: "client",
    entityId: data.id,
    clientId: data.id,
    metadata: { name: v.name, slug: v.slug, program: v.program },
  });

  revalidatePath("/clients");
  return { ok: true, data: { id: data.id } };
}

/** Update editable client fields. Admin only. */
export async function updateClientAction(
  input: ClientUpdateValues,
): Promise<Result> {
  const admin = await requireRole(["admin"]);
  const parsed = clientUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({
      name: v.name,
      industry: v.industry,
      program: v.program,
      status: v.status,
      website_url: clean(v.website_url),
      start_date: clean(v.start_date),
      service_type: clean(v.service_type),
      investment: clean(v.investment),
      comms_channel: clean(v.comms_channel),
      internal_notes: clean(v.internal_notes),
    })
    .eq("id", v.id);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: admin.id,
    action: "client.updated",
    entity: "client",
    entityId: v.id,
    clientId: v.id,
    metadata: { name: v.name, status: v.status },
  });

  revalidatePath(`/clients/${v.id}/settings`);
  revalidatePath("/clients");
  return { ok: true };
}

/** Change client status (soft-delete = set to paused/churned). Admin only. */
export async function setClientStatusAction(
  clientId: string,
  status: ClientStatus,
): Promise<Result> {
  const admin = await requireRole(["admin"]);
  if (!STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ status })
    .eq("id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: admin.id,
    action: "client.status_changed",
    entity: "client",
    entityId: clientId,
    clientId,
    metadata: { status },
  });

  revalidatePath(`/clients/${clientId}/settings`);
  revalidatePath("/clients");
  return { ok: true };
}
