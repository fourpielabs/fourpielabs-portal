"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import {
  projectCreateSchema,
  projectUpdateSchema,
  type ProjectCreateValues,
  type ProjectUpdateValues,
} from "@/lib/schemas";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Project clients create/edit their OWN projects ONLY through the
 * create_project / update_project SECURITY DEFINER RPCs — there is NO direct
 * client INSERT/UPDATE policy on `projects` (the same invariant as
 * toggle_checklist_item / set_deliverable_approval). The RPC re-validates
 * everything server-side: authenticated, caller is a client, client_type =
 * 'project', and (on update) the project belongs to the caller's client.
 * The action layer is convenience validation only; RLS + the RPC are the gate.
 */
export async function createProjectAction(
  input: ProjectCreateValues,
): Promise<Result<{ id: string }>> {
  const profile = await requireProfile();
  if (profile.role !== "client" || !profile.client_id) {
    return { ok: false, error: "Only clients can add projects." };
  }
  const parsed = projectCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_project", {
    p_title: v.title,
    p_description: v.description ?? "",
  });
  if (error) return { ok: false, error: error.message };

  const row = (Array.isArray(data) ? data[0] : data) as { id: string } | null;
  await logAudit({
    actorId: profile.id,
    action: "project.created",
    entity: "project",
    entityId: row?.id,
    clientId: profile.client_id,
    metadata: { title: v.title },
  });

  revalidatePath("/dashboard");
  return { ok: true, data: row ? { id: row.id } : undefined };
}

export async function updateProjectAction(
  input: ProjectUpdateValues,
): Promise<Result> {
  const profile = await requireProfile();
  if (profile.role !== "client" || !profile.client_id) {
    return { ok: false, error: "Only clients can edit projects." };
  }
  const parsed = projectUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("update_project", {
    p_id: v.id,
    p_title: v.title,
    p_description: v.description ?? "",
    p_status: v.status,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: profile.id,
    action: "project.updated",
    entity: "project",
    entityId: v.id,
    clientId: profile.client_id,
    metadata: { title: v.title, status: v.status },
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
