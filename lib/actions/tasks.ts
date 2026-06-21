"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { isCircleMember } from "@/lib/tasks";
import { taskStaffSchema, type TaskStaffValues } from "@/lib/schemas";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const clean = (v: string | undefined | null) => (v && v.length > 0 ? v : null);

function revalidateStaffTasks(clientId: string) {
  revalidatePath(`/clients/${clientId}/tasks`);
  revalidatePath(`/clients/${clientId}`);
}

// ===========================================================================
// STAFF task management (admin / assigned team). Direct table writes under the
// tasks_admin_all / tasks_team_all for-all policies — no RPC. requireClientAccess
// gates to admin-or-assigned; every write is scoped .eq("client_id", clientId).
// The assignee is re-validated to the client's circle (RLS doesn't check that),
// and an INTERNAL source message forces the task staff-only (visible_to_client
// = false) so internal content never surfaces a client-visible task.
// ===========================================================================

/** Resolve final visibility + validate a source message belongs to this client. */
async function resolveSource(
  clientId: string,
  sourceId: string | null,
  requested: boolean,
): Promise<{ ok: true; visible: boolean } | { ok: false; error: string }> {
  if (!sourceId) return { ok: true, visible: requested };
  const admin = createAdminClient();
  const { data: msg } = await admin
    .from("messages")
    .select("client_id, thread_type")
    .eq("id", sourceId)
    .maybeSingle();
  if (!msg || msg.client_id !== clientId) {
    return { ok: false, error: "Source message doesn't belong to this client." };
  }
  // internal-derived task is staff-only — the internal-thread boundary
  return { ok: true, visible: msg.thread_type === "internal" ? false : requested };
}

export async function staffCreateTaskAction(
  clientId: string,
  input: TaskStaffValues,
): Promise<Result<{ id: string }>> {
  const me = await requireClientAccess(clientId);
  const parsed = taskStaffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;

  const assigneeId = clean(v.assignee_id);
  if (assigneeId && !(await isCircleMember(clientId, assigneeId))) {
    return { ok: false, error: "Assignee isn't a member of this client's circle." };
  }
  const src = await resolveSource(clientId, clean(v.source_message_id), v.visible_to_client);
  if (!src.ok) return src;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      client_id: clientId,
      title: v.title,
      description: clean(v.description),
      status: v.status,
      assignee_id: assigneeId,
      due_date: clean(v.due_date),
      visible_to_client: src.visible,
      source_message_id: clean(v.source_message_id),
      is_milestone: v.is_milestone ?? false,
      blocked_by_client: v.blocked_by_client ?? false,
      blocked_reason: clean(v.blocked_reason),
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "task.created",
    entity: "task",
    entityId: data.id,
    clientId,
    metadata: { title: v.title, status: v.status, by: "staff" },
  });
  revalidateStaffTasks(clientId);
  return { ok: true, data: { id: data.id } };
}

export async function staffUpdateTaskAction(
  clientId: string,
  id: string,
  input: TaskStaffValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = taskStaffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;

  const assigneeId = clean(v.assignee_id);
  if (assigneeId && !(await isCircleMember(clientId, assigneeId))) {
    return { ok: false, error: "Assignee isn't a member of this client's circle." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      title: v.title,
      description: clean(v.description),
      status: v.status,
      assignee_id: assigneeId,
      due_date: clean(v.due_date),
      visible_to_client: v.visible_to_client,
      // is_milestone / blocked_* are managed by staffSetTaskFlagsAction (the detail
      // dialog's Advanced controls), NOT this full-edit form — so a title/status
      // edit never resets them.
    })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "task.updated",
    entity: "task",
    entityId: id,
    clientId,
    metadata: { title: v.title, status: v.status, by: "staff" },
  });
  revalidateStaffTasks(clientId);
  return { ok: true };
}

export async function staffSetTaskStatusAction(
  clientId: string,
  id: string,
  status: TaskStaffValues["status"],
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "task.status_changed",
    entity: "task",
    entityId: id,
    clientId,
    metadata: { status },
  });
  revalidateStaffTasks(clientId);
  return { ok: true };
}

// ---- staff: milestone / blocked-by-client flags (detail-dialog Advanced) -------
export async function staffSetTaskFlagsAction(
  clientId: string,
  id: string,
  flags: { is_milestone?: boolean; blocked_by_client?: boolean; blocked_reason?: string | null },
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const patch: Record<string, unknown> = {};
  if (typeof flags.is_milestone === "boolean") patch.is_milestone = flags.is_milestone;
  if (typeof flags.blocked_by_client === "boolean") patch.blocked_by_client = flags.blocked_by_client;
  if (flags.blocked_reason !== undefined) patch.blocked_reason = clean(flags.blocked_reason);
  if (Object.keys(patch).length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(patch).eq("id", id).eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorId: me.id, action: "task.updated", entity: "task", entityId: id, clientId, metadata: { flags: patch } });
  revalidateStaffTasks(clientId);
  return { ok: true };
}

// ---- task dependencies (staff-managed; same-client enforced by a DB trigger) ----
export async function addTaskDependencyAction(
  clientId: string,
  taskId: string,
  blockedByTaskId: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  if (taskId === blockedByTaskId) return { ok: false, error: "A task can't block itself." };
  const supabase = await createClient();
  // both tasks must belong to THIS client (RLS scopes the read; the DB trigger re-checks)
  const { data: rows } = await supabase.from("tasks").select("id").eq("client_id", clientId).in("id", [taskId, blockedByTaskId]);
  if ((rows?.length ?? 0) !== 2) return { ok: false, error: "Both tasks must belong to this client." };
  const { error } = await supabase.from("task_dependencies").insert({ task_id: taskId, blocked_by_task_id: blockedByTaskId, created_by: me.id });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That dependency already exists." };
    return { ok: false, error: error.message };
  }
  await logAudit({ actorId: me.id, action: "task.dependency_changed", entity: "task", entityId: taskId, clientId, metadata: { added: blockedByTaskId } });
  revalidateStaffTasks(clientId);
  return { ok: true };
}

export async function removeTaskDependencyAction(clientId: string, depId: string): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_dependencies").delete().eq("id", depId).select("task_id");
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorId: me.id, action: "task.dependency_changed", entity: "task", entityId: data?.[0]?.task_id ?? null, clientId, metadata: { removed: depId } });
  revalidateStaffTasks(clientId);
  return { ok: true };
}

export async function staffDeleteTaskAction(clientId: string, id: string): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id).eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "task.deleted",
    entity: "task",
    entityId: id,
    clientId,
  });
  revalidateStaffTasks(clientId);
  return { ok: true };
}
