"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireClientAccess } from "@/lib/auth/guards";

type Result = { ok: true } | { ok: false; error: string };

// ===========================================================================
// CLIENT writes — ONLY through the SECURITY DEFINER RPCs (own-client + the parent
// task must be visible_to_client). NO direct client policy on task_checklist_items.
// ===========================================================================
async function clientCall(fn: string, args: Record<string, unknown>): Promise<Result> {
  const profile = await requireProfile();
  if (profile.role !== "client" || !profile.client_id) {
    return { ok: false, error: "Only clients can edit task items here." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

export async function addChecklistItemAction(taskId: string, title: string) {
  return clientCall("add_task_checklist_item", { p_task_id: taskId, p_title: title });
}
export async function toggleChecklistItemAction(itemId: string) {
  return clientCall("toggle_task_checklist_item", { p_item_id: itemId });
}
export async function editChecklistItemAction(itemId: string, title: string) {
  return clientCall("edit_task_checklist_item", { p_item_id: itemId, p_title: title });
}
export async function deleteChecklistItemAction(itemId: string) {
  return clientCall("delete_task_checklist_item", { p_item_id: itemId });
}

// ===========================================================================
// STAFF writes — direct table writes under the task_checklist_items_admin_all /
// _team_all for-all policies (RLS gates the parent task to is_admin / is_assigned).
// requireClientAccess gates admin-or-assigned for this client.
// ===========================================================================
export async function staffAddChecklistItemAction(
  clientId: string,
  taskId: string,
  title: string,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  if (!title.trim()) return { ok: false, error: "Title is required." };
  const supabase = await createClient();
  const { data: top } = await supabase
    .from("task_checklist_items")
    .select("sort_order")
    .eq("task_id", taskId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("task_checklist_items").insert({
    task_id: taskId,
    title: title.trim(),
    sort_order: (top?.sort_order ?? -1) + 1,
    created_by: me.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clients/${clientId}/tasks`);
  return { ok: true };
}

export async function staffToggleChecklistItemAction(
  clientId: string,
  itemId: string,
  isDone: boolean,
): Promise<Result> {
  await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase.from("task_checklist_items").update({ is_done: isDone }).eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clients/${clientId}/tasks`);
  return { ok: true };
}

export async function staffEditChecklistItemAction(
  clientId: string,
  itemId: string,
  title: string,
): Promise<Result> {
  await requireClientAccess(clientId);
  if (!title.trim()) return { ok: false, error: "Title is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("task_checklist_items").update({ title: title.trim() }).eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clients/${clientId}/tasks`);
  return { ok: true };
}

export async function staffDeleteChecklistItemAction(
  clientId: string,
  itemId: string,
): Promise<Result> {
  await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase.from("task_checklist_items").delete().eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clients/${clientId}/tasks`);
  return { ok: true };
}
