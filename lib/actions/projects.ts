"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import {
  projectCreateSchema,
  projectUpdateSchema,
  projectStaffSchema,
  type ProjectCreateValues,
  type ProjectUpdateValues,
  type ProjectStaffValues,
} from "@/lib/schemas";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const clean = (v: string | undefined | null) => (v && v.length > 0 ? v : null);

function revalidateStaffProject(clientId: string) {
  revalidatePath(`/clients/${clientId}/projects`);
  revalidatePath(`/clients/${clientId}/deliverables`);
  revalidatePath(`/clients/${clientId}`);
}

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

// ===========================================================================
// STAFF project management (admin / assigned team). Direct table writes under
// the existing `projects_admin_all` / `projects_team_all` for-all policies — NO
// new RLS. `requireClientAccess` gates to admin-or-assigned; every write is
// scoped `.eq("client_id", clientId)` so staff only touch that client's rows.
// ===========================================================================
export async function staffCreateProjectAction(
  clientId: string,
  input: ProjectStaffValues,
): Promise<Result<{ id: string }>> {
  const me = await requireClientAccess(clientId);
  const parsed = projectStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      client_id: clientId,
      title: v.title,
      description: clean(v.description),
      status: v.status,
      start_date: clean(v.start_date),
      due_date: clean(v.due_date),
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "project.created",
    entity: "project",
    entityId: data.id,
    clientId,
    metadata: { title: v.title, status: v.status, by: "staff" },
  });
  revalidateStaffProject(clientId);
  return { ok: true, data: { id: data.id } };
}

export async function staffUpdateProjectAction(
  clientId: string,
  id: string,
  input: ProjectStaffValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = projectStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update({
      title: v.title,
      description: clean(v.description),
      status: v.status,
      start_date: clean(v.start_date),
      due_date: clean(v.due_date),
    })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "project.updated",
    entity: "project",
    entityId: id,
    clientId,
    metadata: { title: v.title, status: v.status, by: "staff" },
  });
  revalidateStaffProject(clientId);
  return { ok: true };
}

export async function staffSetProjectStatusAction(
  clientId: string,
  id: string,
  status: ProjectStaffValues["status"],
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "project.status_changed",
    entity: "project",
    entityId: id,
    clientId,
    metadata: { status },
  });
  revalidateStaffProject(clientId);
  return { ok: true };
}

export async function staffDeleteProjectAction(
  clientId: string,
  id: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  // deliverables.project_id is ON DELETE SET NULL, so attached deliverables stay.
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "project.deleted",
    entity: "project",
    entityId: id,
    clientId,
  });
  revalidateStaffProject(clientId);
  return { ok: true };
}
