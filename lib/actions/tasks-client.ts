"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { notify, staffUserIds } from "@/lib/notifications";
import {
  taskClientCreateSchema,
  taskClientUpdateSchema,
  type TaskClientCreateValues,
  type TaskClientUpdateValues,
} from "@/lib/schemas";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const orNull = (v: string | undefined | null) => (v && v.length > 0 ? v : null);

/**
 * Clients create tasks ONLY through the create_task SECURITY DEFINER RPC — there
 * is NO direct client INSERT/UPDATE policy on `tasks` (the toggle_checklist_item /
 * create_project precedent). Task STATUS is staff-controlled: the client status RPC
 * (update_task_status) was DROPPED, so a client has no status-write path (it sees
 * status read-only). The RPC re-validates: caller is a client, assignee is in the
 * client's circle, a source message is the client's OWN client_shared message. The
 * action is convenience only.
 */
/**
 * FORMAL milestone sign-off — a client records acceptance of a milestone task.
 * This is a LOGGED acceptance, NOT a legally-binding e-signature (a separate
 * DocuSign-class integration). It writes ONLY client_signed_off_at via the
 * sign_off_milestone RPC (own-client + visible + milestone-gated) — it does NOT
 * change task status (the lock holds). IP + timestamp + user are recorded to the
 * audit log here (the server has the request IP; the RPC stamps the timestamp).
 */
export async function signOffMilestoneAction(taskId: string): Promise<Result> {
  const profile = await requireProfile();
  if (profile.role !== "client") return { ok: false, error: "Only clients can sign off." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("sign_off_milestone", { p_task_id: taskId });
  if (error) return { ok: false, error: error.message };

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0].trim()) || h.get("x-real-ip") || "unknown";
  await logAudit({
    actorId: profile.id,
    action: "milestone.signed_off",
    entity: "task",
    entityId: taskId,
    clientId: profile.client_id,
    metadata: { ip, signed_at: new Date().toISOString(), user_id: profile.id, kind: "formal_logged_acceptance" },
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createTaskAction(
  input: TaskClientCreateValues,
): Promise<Result<{ id: string }>> {
  const profile = await requireProfile();
  if (profile.role !== "client" || !profile.client_id) {
    return { ok: false, error: "Only clients can create tasks here." };
  }
  const parsed = taskClientCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_task", {
    p_title: v.title,
    p_description: v.description ?? "",
    p_assignee: orNull(v.assignee_id),
    p_due_date: orNull(v.due_date),
    p_source_message_id: orNull(v.source_message_id),
  });
  if (error) return { ok: false, error: error.message };

  const row = (Array.isArray(data) ? data[0] : data) as { id: string } | null;
  await logAudit({
    actorId: profile.id,
    action: "task.created",
    entity: "task",
    entityId: row?.id,
    clientId: profile.client_id,
    metadata: { title: v.title, by: "client", fromMessage: Boolean(v.source_message_id) },
  });

  // the client created a task (incl. the chat→task bridge) → notify their staff.
  // Reuses the `message` notification type (no new enum/pref) — the title makes it
  // clear it's a task; the internal boundary is irrelevant here (a client task is
  // always client-visible and only ever notifies STAFF).
  await notify({
    recipients: await staffUserIds(profile.client_id),
    excludeUserId: profile.id,
    type: "message",
    title: v.source_message_id ? "Client added a task from a message" : "Client added a task",
    body: v.title,
    link: `/clients/${profile.client_id}/tasks`,
    clientId: profile.client_id,
  });

  revalidatePath("/tasks");
  return { ok: true, data: row ? { id: row.id } : undefined };
}

/**
 * Client edit of their OWN task's TITLE + DESCRIPTION — via the update_task SECURITY
 * DEFINER RPC (own-client + visible scope). The RPC takes only (id, title, description),
 * so status / assignee / due_date / visible_to_client are unreachable: a client can
 * never escalate through this path. No status side-effects, no notifications.
 */
export async function updateTaskAction(
  input: TaskClientUpdateValues,
): Promise<Result> {
  const profile = await requireProfile();
  if (profile.role !== "client" || !profile.client_id) {
    return { ok: false, error: "Only clients can edit tasks here." };
  }
  const parsed = taskClientUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("update_task", {
    p_task_id: v.id,
    p_title: v.title,
    p_description: v.description ?? "",
  });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: profile.id,
    action: "task.updated",
    entity: "task",
    entityId: v.id,
    clientId: profile.client_id,
    metadata: { title: v.title, by: "client" },
  });
  revalidatePath("/tasks");
  return { ok: true };
}
