"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { notify, staffUserIds } from "@/lib/notifications";
import { taskClientCreateSchema, type TaskClientCreateValues } from "@/lib/schemas";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
type TaskStatus = "todo" | "in_progress" | "done";
const orNull = (v: string | undefined | null) => (v && v.length > 0 ? v : null);

/**
 * Clients create tasks and change status ONLY through the create_task /
 * update_task_status SECURITY DEFINER RPCs — there is NO direct client
 * INSERT/UPDATE policy on `tasks` (the toggle_checklist_item / create_project
 * precedent). The RPC re-validates: caller is a client, assignee is in the
 * client's circle, a source message is the client's OWN client_shared message,
 * and (status) the task is own-client + visible. The action is convenience only.
 */
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

export async function setTaskStatusAction(taskId: string, status: TaskStatus): Promise<Result> {
  const profile = await requireProfile();
  if (profile.role !== "client" || !profile.client_id) {
    return { ok: false, error: "Only clients can update tasks here." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task_status", {
    p_task_id: taskId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: profile.id,
    action: "task.status_changed",
    entity: "task",
    entityId: taskId,
    clientId: profile.client_id,
    metadata: { status, by: "client" },
  });
  revalidatePath("/tasks");
  return { ok: true };
}
