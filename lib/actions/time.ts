"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";

type Result = { ok: true } | { ok: false; error: string };

// ===========================================================================
// STAFF-ONLY time tracking. Every action gates with requireClientAccess (admin or
// assigned team) and writes through the SECURITY DEFINER RPCs (which re-validate
// assigned-staff + own-entry). Clients can never reach these — requireClientAccess
// blocks them, and the RPCs raise for a non-staff caller regardless.
//
// Status coupling: start_timer → 'in_progress'; stop_timer(complete) → 'done';
// a plain stop leaves status untouched. The RPC performs the status write so the
// timer + the staff status path stay atomic.
// ===========================================================================

export async function startTimerAction(clientId: string, taskId: string): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_timer", { p_task_id: taskId });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorId: me.id, action: "task.time_started", entity: "task", entityId: taskId, clientId });
  revalidatePath(`/clients/${clientId}/tasks`);
  return { ok: true };
}

export async function stopTimerAction(
  clientId: string,
  entryId: string,
  complete: boolean,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("stop_timer", { p_entry_id: entryId, p_complete: complete });
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: complete ? "task.time_completed" : "task.time_stopped",
    entity: "time_entry",
    entityId: entryId,
    clientId,
  });
  revalidatePath(`/clients/${clientId}/tasks`);
  return { ok: true };
}

export async function editTimeEntryAction(
  clientId: string,
  entryId: string,
  startedAt: string,
  endedAt: string | null,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_time_entry", {
    p_entry_id: entryId,
    p_started_at: startedAt,
    p_ended_at: endedAt,
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorId: me.id, action: "task.time_edited", entity: "time_entry", entityId: entryId, clientId });
  revalidatePath(`/clients/${clientId}/tasks`);
  return { ok: true };
}

export async function deleteTimeEntryAction(clientId: string, entryId: string): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_time_entry", { p_entry_id: entryId });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorId: me.id, action: "task.time_deleted", entity: "time_entry", entityId: entryId, clientId });
  revalidatePath(`/clients/${clientId}/tasks`);
  return { ok: true };
}
